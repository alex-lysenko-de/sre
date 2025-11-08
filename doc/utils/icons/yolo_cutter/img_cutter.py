"""
Object extraction and segmentation application using geometric grouping strategies.
Extracts black objects from white background and saves them as separate PNG files.
"""

import argparse
import sys
import os
from pathlib import Path
from typing import Callable, List, Set
import numpy as np
import cv2
from shapely.geometry import Polygon, box


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
        self._full_masks = {}

    def validate_input(self):
        """Validate input file exists and strategy is valid."""
        if not os.path.isfile(self.input_file):
            print(f"Error: Input file '{self.input_file}' not found.", file=sys.stderr)
            return False

        # Обновлено: добавлена стратегия 4
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

        # Process each component (skip background at index 0)
        for i in range(1, num_labels):
            x, y, w, h, area = stats[i]

            # Filter small components
            if area < MIN_OBJECT_AREA:
                continue

            # Create full mask for this component (full image size)
            full_mask = (labels == i).astype(np.uint8) * 255
            self._full_masks[len(self.components)] = full_mask # Кэшируем полную маску

            # --- FIX: Crop the mask to the component's BBox ---
            mask = full_mask[y:y + h, x:x + w]

            non_zero_pixels = cv2.countNonZero(mask)
            if self.debug:
                print(f"  Component {i}: Area={area}, BBox=({x}, {y}, {w}, {h}), Non-Zero={non_zero_pixels}")

            # Check that the mask is not empty after cropping (although it shouldn't be)
            if non_zero_pixels == 0:
                if self.debug:
                    print(f"    WARNING: Component {i} skipped: Non-zero area is 0 after BBox crop.")
                del self._full_masks[len(self.components)] # Удаляем, если компонент пропущен
                continue

            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,
                                           cv2.CHAIN_APPROX_SIMPLE)

            if len(contours) == 0:
                if self.debug:
                    print(f"    WARNING: Component {i} skipped: No contours found!")
                del self._full_masks[len(self.components)]
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
                continue

            self.components.append({
                'id': i,
                'bbox': (x, y, w, h),
                'area': area,
                'mask': mask,  # Cropped mask (w x h)
                'hull': hull,  # Hull in global coordinates
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

    # --- GEOMETRIC CHECKS (UNCHANGED LOGIC) ---
    def boxes_intersect(self, bbox_a, bbox_b):
        """Check if expanded bbox of A intersects with unexpanded bbox of B (Original S1 logic)."""
        # Original logic: check expanded BBox A against BBox B (unexpanded)
        x1, y1, w1, h1 = self.expand_bbox(bbox_a)
        x2, y2, w2, h2 = bbox_b

        return not (x1 + w1 < x2 or x2 + w2 < x1 or
                   y1 + h1 < y2 or y2 + h2 < y1)

    def bbox_intersects_hull(self, bbox_a, hull_b):
        """Check if expanded bbox of A intersects with convex hull of B."""
        x, y, w, h = self.expand_bbox(bbox_a)
        rect = box(x, y, x + w, y + h)

        # Convert hull points to polygon
        hull_points = hull_b.reshape(-1, 2).astype(float)

        # Check if hull has at least 3 points (valid polygon)
        if len(hull_points) < 3:
            return False

        try:
            hull_polygon = Polygon(hull_points)
            return rect.intersects(hull_polygon)
        except Exception:
            return False

    def hulls_intersect(self, hull_a, hull_b):
        """Check if expanded hull A intersects with hull B (Original S3 logic)."""
        # Convert hull points to polygons
        hull_a_points = hull_a.reshape(-1, 2).astype(float)
        hull_b_points = hull_b.reshape(-1, 2).astype(float)

        # Check if both hulls have at least 3 points (valid polygons)
        if len(hull_a_points) < 3 or len(hull_b_points) < 3:
            return False

        try:
            polygon_a = Polygon(hull_a_points)
            polygon_b = Polygon(hull_b_points)

            # Expand polygon A by padding
            expanded_a = polygon_a.buffer(self.padding)

            return expanded_a.intersects(polygon_b)
        except Exception:
            return False

    # --- MERGE CONDITIONS (PREDICATES) FOR EACH STRATEGY ---

    def _merge_condition_s1(self, idx_a, idx_b, padding=0): # padding добавлен для унификации
        """Predicate for Strategy 1: Check if BBox_A intersects BBox_B."""
        return self.boxes_intersect(self.components[idx_a]['bbox'], self.components[idx_b]['bbox']) or \
               self.boxes_intersect(self.components[idx_b]['bbox'], self.components[idx_a]['bbox'])

    def _merge_condition_s2(self, idx_a, idx_b, padding=0): # padding добавлен для унификации
        """Predicate for Strategy 2: Check BBox-Hull or Hull-BBox intersection."""
        comp_a = self.components[idx_a]
        comp_b = self.components[idx_b]

        # Check expanded bbox_a with hull_b
        if self.bbox_intersects_hull(comp_a['bbox'], comp_b['hull']):
            return True

        # Also check expanded bbox_b with hull_a
        if self.bbox_intersects_hull(comp_b['bbox'], comp_a['hull']):
            return True

        return False

    def _merge_condition_s3(self, idx_a, idx_b, padding=0): # padding добавлен для унификации
        """Predicate for Strategy 3: Check Hull-Hull intersection."""
        # Hull-Hull intersection (S3) is symmetric, so we only check one way (Hull A expanded vs Hull B)
        return self.hulls_intersect(self.components[idx_a]['hull'], self.components[idx_b]['hull'])

    # ----------------------------------------------------------------------
    # НОВЫЙ ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Получение полной маски компонента
    # ----------------------------------------------------------------------
    def get_component_mask_full(self, comp_idx: int) -> np.ndarray:
        """
        Возвращает полную бинарную маску компонента в размере исходного изображения.

        Используется кэш self._full_masks для повышения производительности.
        """
        # Индекс компонента соответствует порядку его добавления в self.components
        if comp_idx in self._full_masks:
            return self._full_masks[comp_idx]

        # Если маска не кэширована, восстанавливаем (что не должно происходить после find_components)
        print(f"Warning: Full mask for component {comp_idx} not cached. Recreating.")
        comp = self.components[comp_idx]
        x, y, w, h = comp['bbox']

        full_mask = np.zeros_like(self.binary)

        # Размещаем обрезанную маску обратно в полную маску (для случаев, когда маски не кэшированы)
        full_mask[y:y + h, x:x + w] = comp['mask']

        self._full_masks[comp_idx] = full_mask
        return full_mask

    # ----------------------------------------------------------------------
    # НОВЫЙ МЕТОД: Условие слияния для Стратегии 4 (Dilated Mask Intersection)
    # ----------------------------------------------------------------------
    def _merge_condition_s4(self, idx_a: int, idx_b: int, padding: int) -> bool:
        """
        Predicate for Strategy 4: Check if Dilated Mask A intersects Dilated Mask B.

        Использует дилатацию (cv2.dilate) для увеличения области маски.
        """
        if padding <= 0:
            # При нулевом паддинге проверяем обычное пересечение масок (по сути, S1/S3 в идеале)
            mask_a = self.get_component_mask_full(idx_a)
            mask_b = self.get_component_mask_full(idx_b)
            intersection = cv2.bitwise_and(mask_a, mask_b)
            return np.sum(intersection) > 0

        # 1. Получить полные маски
        mask_a = self.get_component_mask_full(idx_a)
        mask_b = self.get_component_mask_full(idx_b)

        # 2. Создать ядро для дилатации
        # Размер ядра: (2*padding + 1)x(2*padding + 1) для круговой дилатации на 'padding' пикселей
        kernel_size = 2 * padding + 1
        # Круглое ядро (эллипс), чтобы дилатация была более равномерной
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))

        # 3. Дилатировать обе маски
        dilated_mask_a = cv2.dilate(mask_a, kernel, iterations=1)
        dilated_mask_b = cv2.dilate(mask_b, kernel, iterations=1)

        # 4. Проверить пересечение дилатированных масок
        intersection = cv2.bitwise_and(dilated_mask_a, dilated_mask_b)

        # 5. Вернуть True, если есть любое пересечение (сумма пикселей > 0)
        return np.sum(intersection) > 0

    # --- REFACTORED CORE GROUPING METHOD (Обновлено для приема padding) ---

    def group_components_by_strategy(self, strategy_name: str, merge_condition: Callable, padding: int = 0) -> List[Set[int]]:
        """
        Groups components iteratively based on a given merge_condition function.

        Args:
            strategy_name (str): Name of the strategy for logging.
            merge_condition (callable): A function that takes two component indices
                                        (idx_a, idx_b) and the padding, and returns True if they should merge.
            padding (int): The padding value (used by S4).

        Returns:
            list[set]: A list of sets, where each set contains component indices belonging to a group.
        """
        print(f"Applying Strategy {self.strategy}: {strategy_name} (padding={self.padding})...")

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
                if i in used:
                    continue

                group_a = groups[i]

                for j in range(i + 1, len(groups)):
                    if j in used:
                        continue

                    group_b = groups[j]

                    # Check if any component from A intersects with any from B using the condition
                    should_merge = False
                    for idx_a in group_a:
                        for idx_b in group_b:
                            # ! ВАЖНОЕ ИЗМЕНЕНИЕ: Передача padding в merge_condition
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

        return groups

    def get_group_bbox(self, group_indices):
        """Get bounding box for a group of components."""
        # Логика get_group_bbox остается неизменной
        # ... (код) ...
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
        # Логика get_group_mask остается неизменной
        # ... (код) ...
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
        # Логика extract_objects остается неизменной
        # ... (код) ...
        if not groups:
            print("Warning: No objects found.", file=sys.stderr)
            return False

        print(f"Found {len(groups)} object(s). Extracting...")

        # Extract and save each group
        for group_num, group_indices in enumerate(groups, 1):
            # Get bounding box for the group
            x, y, w, h = self.get_group_bbox(list(group_indices))

            # Ensure valid bounds
            if w <= 0 or h <= 0:
                if self.debug:
                    print(f"  Warning: Invalid bounds for group {group_num}, skipping.")
                continue

            # Ensure bounds are within image
            x = max(0, x)
            y = max(0, y)
            w = min(w, self.image.shape[1] - x)
            h = min(h, self.image.shape[0] - y)

            if w <= 0 or h <= 0:
                if self.debug:
                    print(f"  Warning: Bounds outside image for group {group_num}, skipping.")
                continue

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

            if self.debug:
                print(f"  Saved: {output_file}")
                print(f"    Components: {len(group_indices)}")
                print(f"    Size: {w}x{h} pixels")
                print(f"    Non-zero pixels in mask: {cv2.countNonZero(mask)}")
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

        # Validate input
        if not self.validate_input():
            return False

        # Create output directory
        self.create_output_directory()

        # Preprocess image
        if not self.preprocess():
            return False

        # Find components
        if not self.find_components():
            print("Warning: No components found.", file=sys.stderr)
            return False

        # --- ОБНОВЛЕННАЯ ЛОГИКА ГРУППИРОВКИ ---
        groups = []
        if self.strategy == 0: # No grouping
            groups = [{i} for i in range(len(self.components))]
        elif self.strategy == 1: # BBox Intersection (S1)
            groups = self.group_components_by_strategy("BBox Intersection", self._merge_condition_s1, self.padding)
        elif self.strategy == 2: # BBox-Hull Intersection (S2)
            groups = self.group_components_by_strategy("BBox-Hull Intersection", self._merge_condition_s2, self.padding)
        elif self.strategy == 3: # Hull-Hull Intersection (S3)
            groups = self.group_components_by_strategy("Hull-Hull Intersection", self._merge_condition_s3, self.padding)
        elif self.strategy == 4: # Dilated Mask Intersection (S4)
            groups = self.group_components_by_strategy("Dilated Mask Intersection", self._merge_condition_s4, self.padding)

        # Extract and save objects
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
  python extract_objects.py image.jpg -s 4 -p 10 --debug  # <-- NEW STRATEGY 4
        """
    )

    parser.add_argument(
        "input_file",
        help="Path to input image file"
    )

    parser.add_argument(
        "--strategy", "-s",
        type=int,
        default=1,
        choices=[0, 1, 2, 3, 4], # Обновлено
        help="Grouping strategy: 0=None, 1=BBox Intersection, 2=BBox-Hull Intersection, 3=Hull-Hull Intersection, 4=Dilated Mask Intersection (default: 1)"
    )

    parser.add_argument(
        "--padding", "-p",
        type=int,
        default=10,
        help="Padding for bounding box/mask expansion in pixels (default: 10)"
    )

    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug output"
    )

    args = parser.parse_args()

    # Create extractor and run
    extractor = ObjectExtractor(args.input_file, args.strategy, args.padding, args.debug)
    success = extractor.run()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()