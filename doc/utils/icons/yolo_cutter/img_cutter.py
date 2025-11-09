"""
Object extraction and segmentation application using geometric grouping strategies.
Extracts black objects from white background and saves them as separate PNG files.
"""

import argparse
import sys
import os
import time # <-- ДОБАВЛЕНО
from pathlib import Path
from typing import Callable, List, Set, Optional, Dict
import numpy as np
import cv2
from shapely.geometry import Polygon, box, base


# Configuration constants
THRESHOLD_VALUE = 128
MIN_OBJECT_AREA = 4  # Minimum area to consider as object


class ObjectExtractor:
    """Handles extraction and segmentation of objects from images."""

    def __init__(self, input_file, strategy=1, padding=10, debug=False):
        """
        Initialize the extractor.

        Args:
            input_file: Path to input image
            strategy: Grouping strategy (0, 1, 2, 3, 4)
            padding: Expansion of bounding boxes/masks
            debug: Enable debug output
        """
        self.input_file = input_file
        self.strategy = strategy
        self.padding = padding
        self.debug = debug
        self.image = None
        self.gray = None
        self.binary = None
        self.output_dir = None
        self.components = []
        # Store full mask for each component (for S4)
        self._full_masks: Dict[int, np.ndarray] = {}

        # --- КЭШИ ДЛЯ ГЕОМЕТРИИ ---
        # Кэш для базовых (не расширенных) полигонов Shapely
        self._cached_shapely_polygons: Dict[int, Optional[Polygon]] = {}
        # Кэш для расширенных/дилатированных объектов (зависит от padding и strategy)
        self._cached_expanded_geometries: Dict[int, Optional[base.BaseGeometry | np.ndarray]] = {}
        # Значения, для которых был создан кэш _cached_expanded_geometries
        self._cache_padding_value: int = -1
        self._cache_strategy_value: int = -1

        # --- НОВЫЙ БЛОК: СЧЕТЧИКИ КЭША ---
        self._cache_hits = 0
        self._cache_misses = 0
        # --- КОНЕЦ НОВОГО БЛОКА ---


    def validate_input(self):
        """Validate input file exists and strategy is valid."""
        if not os.path.isfile(self.input_file):
            print(f"Error: Input file '{self.input_file}' not found.", file=sys.stderr)
            return False
        if self.strategy not in [0, 1, 2, 3, 4]:
            print(f"Error: Invalid strategy '{self.strategy}'. Must be 0, 1, 2, 3, or 4.",
                  file=sys.stderr)
            return False
        if self.padding < 0:
            print(f"Error: Padding must be non-negative.", file=sys.stderr)
            return False
        return True

    def create_output_directory(self):
        """Create output directory based on input filename."""
        base_name = Path(self.input_file).stem
        self.output_dir = Path(base_name)
        self.output_dir.mkdir(exist_ok=True)
        print(f"Output directory: {self.output_dir}")

    def preprocess(self):
        """Load and preprocess the image."""
        print("Reading image...")
        self.image = cv2.imread(self.input_file)
        if self.image is None:
            print(f"Error: Failed to read image '{self.input_file}'.", file=sys.stderr)
            return False
        print(f"Image size: {self.image.shape}")
        print("Converting to grayscale...")
        self.gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        print("Binarizing...")
        _, self.binary = cv2.threshold(self.gray, THRESHOLD_VALUE, 255,
                                       cv2.THRESH_BINARY_INV)
        # Очистка кэша масок при новой предобработке
        self._full_masks = {}
        return True

    def find_components(self):
        """Find connected components and extract geometric data."""
        print("Finding connected components...")
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            self.binary, connectivity=8
        )

        self.components = []
        self._full_masks = {} # Очистка кэша масок

        # --- ИЗМЕНЕНИЕ: Полная очистка кэшей геометрии (и счетчиков) ---
        self._clear_geometry_cache(clear_all=True)

        # Process each component (skip background at index 0)
        for i in range(1, num_labels):
            x, y, w, h, area = stats[i]
            if area < MIN_OBJECT_AREA: continue

            component_index = len(self.components)
            # Create full mask for this component (full image size)
            full_mask = (labels == i).astype(np.uint8) * 255
            self._full_masks[component_index] = full_mask
            mask = full_mask[y:y + h, x:x + w]
            non_zero_pixels = cv2.countNonZero(mask)

            # Check that the mask is not empty after cropping (although it shouldn't be)
            if non_zero_pixels == 0:
                del self._full_masks[component_index]
                continue

            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,
                                           cv2.CHAIN_APPROX_SIMPLE)
            if len(contours) == 0:
                del self._full_masks[component_index]
                continue

            # Get convex hull
            try:
                # NOTE: Contours now have local coordinates,
                # but for hull, which is used in geometric checks,
                # global coordinates are needed. Restore global coordinates for hull.
                hull = cv2.convexHull(contours[0])
                hull[:, 0, 0] += x  # Shift X
                hull[:, 0, 1] += y  # Shift Y
            except cv2.error:
                del self._full_masks[component_index]
                continue

            self.components.append({
                'id': i,
                'bbox': (x, y, w, h),
                'area': area,
                'mask': mask,
                'hull': hull,
                'centroid': centroids[i]
            })

        if self.debug:
            print(f"Found {len(self.components)} components")

        return len(self.components) > 0

    def expand_bbox(self, bbox):
        """Expand bounding box by padding."""
        x, y, w, h = bbox
        x_pad = max(0, x - self.padding)
        y_pad = max(0, y - self.padding)
        w_pad = w + 2 * self.padding
        h_pad = h + 2 * self.padding
        return (x_pad, y_pad, w_pad, h_pad)

    # --- GEOMETRIC CHECKS (Используют кэш) ---

    def boxes_intersect(self, bbox_a, bbox_b):
        """Check if expanded bbox of A intersects with unexpanded bbox of B (Original S1 logic)."""
        x1, y1, w1, h1 = self.expand_bbox(bbox_a)
        x2, y2, w2, h2 = bbox_b
        return not (x1 + w1 < x2 or x2 + w2 < x1 or
                   y1 + h1 < y2 or y2 + h2 < y1)

    def bbox_intersects_hull(self, bbox_a, hull_b_idx: int) -> bool:
        """Check if expanded bbox of A intersects with convex hull of B (uses cache)."""
        x, y, w, h = self.expand_bbox(bbox_a)
        rect = box(x, y, x + w, y + h)

        # --- ИЗМЕНЕНИЕ: Используем кэшированный полигон ---
        hull_polygon = self._get_shapely_polygon(hull_b_idx)
        if not hull_polygon:
            return False
        try:
            return rect.intersects(hull_polygon)
        except Exception:
            return False

    def hulls_intersect(self, hull_a_idx: int, hull_b_idx: int) -> bool:
        """Check if expanded hull A intersects with hull B (uses cache)."""
        # Получаем РАСШИРЕННЫЙ кэшированный полигон A (для S3)
        expanded_a = self._get_expanded_hull_s3(hull_a_idx)
        if not expanded_a:
            return False

        # Получаем НЕ РАСШИРЕННЫЙ кэшированный полигон B
        polygon_b = self._get_shapely_polygon(hull_b_idx)
        if not polygon_b:
            return False

        try:
            return expanded_a.intersects(polygon_b)
        except Exception:
            return False

    # --- MERGE CONDITIONS (Без изменений, используют индексы) ---

    def _merge_condition_s1(self, idx_a, idx_b, padding=0):
        """Predicate for Strategy 1: Check if BBox_A intersects BBox_B."""
        return self.boxes_intersect(self.components[idx_a]['bbox'], self.components[idx_b]['bbox']) or \
               self.boxes_intersect(self.components[idx_b]['bbox'], self.components[idx_a]['bbox'])

    def _merge_condition_s2(self, idx_a, idx_b, padding=0):
        comp_a = self.components[idx_a]
        comp_b = self.components[idx_b]
        if self.bbox_intersects_hull(comp_a['bbox'], idx_b): return True
        if self.bbox_intersects_hull(comp_b['bbox'], idx_a): return True
        return False

    def _merge_condition_s3(self, idx_a, idx_b, padding=0):
        return self.hulls_intersect(idx_a, idx_b) or self.hulls_intersect(idx_b, idx_a)

    # ----------------------------------------------------------------------
    # МЕТОДЫ УПРАВЛЕНИЯ КЭШЕМ (с логированием)
    # ----------------------------------------------------------------------

    def _clear_geometry_cache(self, clear_all: bool = False):
        """Очищает кэши геометрии и сбрасывает счетчики."""

        # Сброс счетчиков
        self._cache_hits = 0
        self._cache_misses = 0

        if self._cache_padding_value != -1 or self._cache_strategy_value != -1:
            if self.debug:
                print("Clearing expanded geometry cache...")
            self._cached_expanded_geometries = {}
            self._cache_padding_value = -1
            self._cache_strategy_value = -1

        if clear_all and self._cached_shapely_polygons:
            if self.debug:
                print("Clearing base shapely polygon cache...")
            self._cached_shapely_polygons = {}

    def _get_shapely_polygon(self, comp_idx: int) -> Optional[Polygon]:
        """
        Возвращает (или создает и кэширует) базовый (не расширенный)
        полигон Shapely для выпуклой оболочки компонента.
        (Реализует "ленивое" кэширование)
        """
        # 1. Проверка кэша (HIT)
        if comp_idx in self._cached_shapely_polygons:
            self._cache_hits += 1
            return self._cached_shapely_polygons[comp_idx]

        # 2. (MISS) Вычисление
        self._cache_misses += 1
        if self.debug:
            print(f"  [Cache MISS] Creating base polygon for comp {comp_idx}")

        comp = self.components[comp_idx]
        hull_points = comp['hull'].reshape(-1, 2).astype(float)

        if len(hull_points) < 3:
            self._cached_shapely_polygons[comp_idx] = None # Кэшируем ошибку
            return None

        try:
            polygon = Polygon(hull_points)
            self._cached_shapely_polygons[comp_idx] = polygon # 3. Сохранение в кэш
            return polygon
        except Exception:
            self._cached_shapely_polygons[comp_idx] = None
            return None

    def _get_expanded_hull_s3(self, comp_idx: int) -> Optional[Polygon]:
        """
        Возвращает (или создает и кэширует) РАСШИРЕННЫЙ полигон Shapely (S3).
        (Реализует "ленивое" кэширование)
        """
        # 1. Проверка кэша (HIT)
        if comp_idx in self._cached_expanded_geometries:
            self._cache_hits += 1
            return self._cached_expanded_geometries[comp_idx] # type: ignore

        # 2. (MISS) Вычисление
        self._cache_misses += 1
        if self.debug:
            print(f"  [Cache MISS] Creating S3-ExpandedHull for comp {comp_idx} (padding={self.padding})")

        # Получаем базовый полигон (из его кэша)
        polygon = self._get_shapely_polygon(comp_idx)
        if not polygon:
            self._cached_expanded_geometries[comp_idx] = None
            return None

        try:
            expanded_polygon = polygon.buffer(self.padding)
            self._cached_expanded_geometries[comp_idx] = expanded_polygon # 3. Сохранение в кэш
            return expanded_polygon
        except Exception as e:
            if self.debug:
                print(f"  Warning: Failed to buffer hull for comp {comp_idx}: {e}")
            self._cached_expanded_geometries[comp_idx] = None
            return None

    def _get_dilated_mask_s4(self, comp_idx: int) -> Optional[np.ndarray]:
        """
        Возвращает (или создает и кэширует) ДИЛАТИРОВАННУЮ маску (S4).
        (Реализует "ленивое" кэширование)
        """
        # 1. Проверка кэша (HIT)
        if comp_idx in self._cached_expanded_geometries:
            self._cache_hits += 1
            return self._cached_expanded_geometries[comp_idx] # type: ignore

        # 2. (MISS) Вычисление
        self._cache_misses += 1
        if self.debug:
            print(f"  [Cache MISS] Creating S4-DilatedMask for comp {comp_idx} (padding={self.padding})")

        mask = self.get_component_mask_full(comp_idx)

        if self.padding <= 0:
            self._cached_expanded_geometries[comp_idx] = mask # 3. Сохранение в кэш (без дилатации)
            return mask

        try:
            kernel_size = 2 * self.padding + 1
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))

            dilated_mask = cv2.dilate(mask, kernel, iterations=1)
            self._cached_expanded_geometries[comp_idx] = dilated_mask # 3. Сохранение в кэш
            return dilated_mask
        except Exception as e:
            if self.debug:
                print(f"  Warning: Failed to dilate mask for comp {comp_idx}: {e}")
            self._cached_expanded_geometries[comp_idx] = None
            return None

    # ----------------------------------------------------------------------
    # ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Получение полной маски компонента
    # ----------------------------------------------------------------------
    def get_component_mask_full(self, comp_idx: int) -> np.ndarray:
        """
        Возвращает полную бинарную маску компонента в размере исходного изображения.
        (Использует кэш self._full_masks)
        """
        if comp_idx in self._full_masks:
            return self._full_masks[comp_idx]

        # Аварийный случай
        print(f"Warning: Full mask for component {comp_idx} not cached. Recreating.")
        comp = self.components[comp_idx]
        x, y, w, h = comp['bbox']
        full_mask = np.zeros_like(self.binary)
        full_mask[y:y + h, x:x + w] = comp['mask']
        self._full_masks[comp_idx] = full_mask
        return full_mask

    # ----------------------------------------------------------------------
    # Условие слияния для Стратегии 4 (Dilated Mask Intersection)
    # ----------------------------------------------------------------------
    def _merge_condition_s4(self, idx_a: int, idx_b: int, padding: int) -> bool:
        """
        Predicate for Strategy 4: Check if Dilated Mask A intersects Dilated Mask B.
        (Использует кэш)
        """

        # --- ИЗМЕНЕНИЕ: Используем "ленивые" геттеры ---
        dilated_mask_a = self._get_dilated_mask_s4(idx_a)
        dilated_mask_b = self._get_dilated_mask_s4(idx_b)

        if dilated_mask_a is None or dilated_mask_b is None:
            return False

        intersection = cv2.bitwise_and(dilated_mask_a, dilated_mask_b)
        return np.sum(intersection) > 0

    # --- REFACTORED CORE GROUPING METHOD (Удалено "агрессивное" кэширование) ---

    def group_components_by_strategy(self, strategy_name: str, merge_condition: Callable, padding: int) -> List[Set[int]]:
        """
        Groups components iteratively based on a given merge_condition function.
        (Использует "ленивое" кэширование и таймеры)
        """
        print(f"Applying Strategy {self.strategy}: {strategy_name} (padding={self.padding})...")

        # --- НОВЫЙ БЛОК: ТАЙМЕР ---
        start_time = time.perf_counter()

        # --- БЛОК УПРАВЛЕНИЯ КЭШЕМ (Инвалидация) ---
        # Проверяем, нужно ли инвалидировать кэш расширенных объектов
        if self.padding != self._cache_padding_value or self.strategy != self._cache_strategy_value:
            if self.debug:
                print(f"Cache invalidated (padding or strategy changed). "
                      f"Old (P, S): ({self._cache_padding_value}, {self._cache_strategy_value}), "
                      f"New (P, S): ({self.padding}, {self.strategy})")

            # Очищаем только кэш расширенных объектов И СЧЕТЧИКИ
            self._clear_geometry_cache(clear_all=False)
            self._cache_padding_value = self.padding
            self._cache_strategy_value = self.strategy

        elif self.debug:
            print("Using existing geometry cache.")

        # --- "АГРЕССИВНОЕ" КЭШИРОВАНИЕ УДАЛЕНО ОТСЮДА ---


        # Initialize groups (each component is its own group)
        groups: List[Set[int]] = [set([i]) for i in range(len(self.components))]

        # Iteratively merge intersecting groups
        merged = True
        iteration = 0
        while merged:
            iteration += 1
            merged = False
            new_groups: List[Set[int]] = []
            used = set()

            for i in range(len(groups)):
                if i in used: continue
                group_a = groups[i]

                for j in range(i + 1, len(groups)):
                    if j in used: continue
                    group_b = groups[j]

                    should_merge = False
                    for idx_a in group_a:
                        for idx_b in group_b:
                            # ! ВАЖНО: Вызов merge_condition теперь "лениво"
                            # заполнит кэш при первом вызове
                            if merge_condition(idx_a, idx_b, self.padding):
                                should_merge = True
                                break
                        if should_merge:
                            break

                    if should_merge:
                        group_a = group_a.union(group_b)
                        used.add(j)
                        merged = True

                new_groups.append(group_a)

            groups = new_groups

            if self.debug:
                print(f"  Iteration {iteration}: {len(groups)} groups")

        if self.debug:
            print(f"Final groups: {len(groups)}")

        # --- НОВЫЙ БЛОК: ВЫВОД ТАЙМЕРА И СТАТИСТИКИ ---
        end_time = time.perf_counter()
        elapsed = end_time - start_time
        print(f"Grouping complete in {elapsed:.4f} seconds.")
        print(f"Cache Stats: {self._cache_hits} hits, {self._cache_misses} misses.")
        # --- КОНЕЦ НОВОГО БЛОКА ---

        return groups

    def get_group_bbox(self, group_indices):
        """Get bounding box for a group of components."""
        xs = [self.components[i]['bbox'][0] for i in group_indices]
        ys = [self.components[i]['bbox'][1] for i in group_indices]
        ws = [self.components[i]['bbox'][2] for i in group_indices]
        hs = [self.components[i]['bbox'][3] for i in group_indices]
        x = min(xs)
        y = min(ys)
        x_max = max([xs[idx] + ws[idx] for idx in range(len(group_indices))])
        y_max = max([ys[idx] + hs[idx] for idx in range(len(group_indices))])
        w = x_max - x
        h = y_max - y
        return x, y, w, h

    def get_group_mask(self, group_indices, bbox):
        """Get combined mask for a group of components within a bounding box."""
        x, y, w, h = bbox
        mask = np.zeros((h, w), dtype=np.uint8)
        for idx in group_indices:
            comp = self.components[idx]
            comp_mask = comp['mask']
            comp_x, comp_y, comp_w, comp_h = comp['bbox']
            dst_x_start = comp_x - x
            dst_y_start = comp_y - y
            dst_x_end = dst_x_start + comp_w
            dst_y_end = dst_y_start + comp_h
            mask[dst_y_start:dst_y_end, dst_x_start:dst_x_end] = cv2.bitwise_or(
                mask[dst_y_start:dst_y_end, dst_x_start:dst_x_end], comp_mask
            )
        return mask

    def extract_objects(self, groups):
        """
        Extract and save objects from groups using mask-based extraction.
        """
        if not groups:
            print("Warning: No objects found.", file=sys.stderr)
            return False
        print(f"Found {len(groups)} object(s). Extracting...")
        for group_num, group_indices in enumerate(groups, 1):
            # Get bounding box for the group
            x, y, w, h = self.get_group_bbox(list(group_indices))
            if w <= 0 or h <= 0: continue
            # Ensure bounds are within image
            x = max(0, x)
            y = max(0, y)
            w = min(w, self.image.shape[1] - x)
            h = min(h, self.image.shape[0] - y)
            if w <= 0 or h <= 0: continue
            # Crop image
            cropped = self.image[y:y + h, x:x + w]
            # Create mask for the group
            mask = self.get_group_mask(list(group_indices), (x, y, w, h))
            # Verify mask is not empty
            if cv2.countNonZero(mask) == 0:
                print(f"  Warning: Empty mask for group {group_num}, skipping.", file=sys.stderr)
                continue
            # Convert to RGBA
            rgba = cv2.cvtColor(cropped, cv2.COLOR_BGR2BGRA)
            # Apply mask to alpha channel
            rgba[:, :, 3] = mask
            # Save PNG with transparency
            output_file = self.output_dir / f"object_{group_num:03d}.png"
            success = cv2.imwrite(str(output_file), rgba)
            if not success:
                print(f"  Error saving: {output_file}", file=sys.stderr)
                continue
            else:
                print(f"  Saved: {output_file}")
        return True

    def run(self):
        """Execute the full extraction pipeline."""
        print("=" * 60)
        print("Object Extraction and Segmentation Tool (Geometric Grouping)")
        print(f"Strategy: {self.strategy} | Padding: {self.padding}")
        if self.debug:
            print("Debug mode: ON")
        print("=" * 60)
        if not self.validate_input(): return False
        self.create_output_directory()
        if not self.preprocess(): return False
        if not self.find_components():
            print("Warning: No components found.", file=sys.stderr)
            return False

        groups = []
        if self.strategy == 0:
            groups = [{i} for i in range(len(self.components))]
        elif self.strategy == 1:
            groups = self.group_components_by_strategy("BBox Intersection", self._merge_condition_s1, self.padding)
        elif self.strategy == 2:
            groups = self.group_components_by_strategy("BBox-Hull Intersection", self._merge_condition_s2, self.padding)
        elif self.strategy == 3:
            groups = self.group_components_by_strategy("Hull-Hull Intersection", self._merge_condition_s3, self.padding)
        elif self.strategy == 4:
            groups = self.group_components_by_strategy("Dilated Mask Intersection", self._merge_condition_s4, self.padding)

        success = self.extract_objects(groups)
        if success:
            print("=" * 60)
            print("Done!")
            print("=" * 60)
        return success


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract and segment black objects from white background images using geometric grouping.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python extract_objects.py source.png
  python extract_objects.py source.png --strategy 2 --padding 15
  python extract_objects.py image.jpg -s 4 -p 10 --debug
        """
    )
    parser.add_argument("input_file", help="Path to input image file")
    parser.add_argument(
        "--strategy", "-s",
        type=int,
        default=1,
        choices=[0, 1, 2, 3, 4],
        help="Grouping strategy: 0=None, 1=BBox Intersection, 2=BBox-Hull Intersection, 3=Hull-Hull Intersection, 4=Dilated Mask Intersection (default: 1)"
    )
    parser.add_argument(
        "--padding", "-p",
        type=int,
        default=10,
        help="Padding for bounding box/mask expansion in pixels (default: 10)"
    )
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    args = parser.parse_args()

    # Create extractor and run
    extractor = ObjectExtractor(args.input_file, args.strategy, args.padding, args.debug)
    success = extractor.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()