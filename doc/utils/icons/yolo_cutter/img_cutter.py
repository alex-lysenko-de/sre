"""
Object extraction and segmentation application using geometric grouping strategies.
Extracts black objects from white background and saves them as separate PNG files.
"""

import argparse
import sys
import os
from pathlib import Path
import numpy as np
import cv2
from shapely.geometry import Polygon, box


# Configuration constants
THRESHOLD_VALUE = 128
MIN_OBJECT_AREA = 20  # Minimum area to consider as object


class ObjectExtractor:
    """Handles extraction and segmentation of objects from images."""

    def __init__(self, input_file, strategy=1, padding=10, debug=False):
        """
        Initialize the extractor.

        Args:
            input_file: Path to input image
            strategy: Grouping strategy (0, 1, 2, )
            padding: Expansion of bounding boxes
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

    def validate_input(self):
        """Validate input file exists and strategy is valid."""
        if not os.path.isfile(self.input_file):
            print(f"Error: Input file '{self.input_file}' not found.", file=sys.stderr)
            return False

        if self.strategy not in [0, 1, 2, 3]:
            print(f"Error: Invalid strategy '{self.strategy}'. Must be 0, 1, 2, or 3.",
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

        return True

    def find_components(self):
        """Find connected components and extract geometric data."""
        print("Finding connected components...")
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            self.binary, connectivity=8
        )

        self.components = []

        # Process each component (skip background at index 0)
        for i in range(1, num_labels):
            x, y, w, h, area = stats[i]

            # Filter small components
            if area < MIN_OBJECT_AREA:
                continue

            # Create mask for this component (full image size)
            full_mask = (labels == i).astype(np.uint8) * 255

            # --- FIX: Crop the mask to the component's BBox ---
            mask = full_mask[y:y + h, x:x + w]

            non_zero_pixels = cv2.countNonZero(mask)
            if self.debug:
                print(f"  Component {i}: Area={area}, BBox=({x}, {y}, {w}, {h}), Non-Zero={non_zero_pixels}")

            # Check that the mask is not empty after cropping (although it shouldn't be)
            if non_zero_pixels == 0:
                if self.debug:
                    print(f"    WARNING: Component {i} skipped: Non-zero area is 0 after BBox crop.")
                continue

            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,  # ! Important: now finding contours in the cropped mask!
                                           cv2.CHAIN_APPROX_SIMPLE)

            if len(contours) == 0:
                if self.debug:
                    print(f"    WARNING: Component {i} skipped: No contours found!")
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
                'mask': mask,  # <-- Now this is the cropped mask (w x h)
                'hull': hull,  # <-- Now this is the hull in global coordinates
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

    def _merge_condition_s1(self, idx_a, idx_b):
        """Predicate for Strategy 1: Check if BBox_A intersects BBox_B."""
        # Original S1 logic checked BBox A (expanded) against BBox B (unexpanded),
        # then BBox B (expanded) against BBox A (unexpanded).
        # We need to call the boxes_intersect with the correct order for the expansion to happen.
        return self.boxes_intersect(self.components[idx_a]['bbox'], self.components[idx_b]['bbox']) or \
               self.boxes_intersect(self.components[idx_b]['bbox'], self.components[idx_a]['bbox'])

    def _merge_condition_s2(self, idx_a, idx_b):
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

    def _merge_condition_s3(self, idx_a, idx_b):
        """Predicate for Strategy 3: Check Hull-Hull intersection."""
        # Hull-Hull intersection (S3) is symmetric, so we only check one way (Hull A expanded vs Hull B)
        # because the internal check already performs the expansion on the first argument.
        return self.hulls_intersect(self.components[idx_a]['hull'], self.components[idx_b]['hull'])

    # --- REFACTORED CORE GROUPING METHOD ---

    def group_components_by_strategy(self, strategy_name, merge_condition):
        """
        Groups components iteratively based on a given merge_condition function.

        Args:
            strategy_name (str): Name of the strategy for logging.
            merge_condition (callable): A function that takes two component indices
                                        (idx_a, idx_b) and returns True if they should merge.

        Returns:
            list[set]: A list of sets, where each set contains component indices belonging to a group.
        """
        print(f"Applying Strategy {self.strategy}: {strategy_name} (padding={self.padding})...")

        # Initialize groups (each component is its own group)
        groups = [set([i]) for i in range(len(self.components))]

        # Iteratively merge intersecting groups
        merged = True
        iteration = 0
        while merged:
            iteration += 1
            merged = False
            new_groups = []
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
                            if merge_condition(idx_a, idx_b):
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
            comp_mask = comp['mask']  # This is the mask of size w_comp x h_comp
            comp_x, comp_y, comp_w, comp_h = comp['bbox']

            # Define the destination (DST) region inside the group mask (mask)
            # x/y - start of the group BBox
            # comp_x/comp_y - start of the component BBox

            # Start of the component in the group mask (dst - destination)
            dst_x_start = comp_x - x
            dst_y_start = comp_y - y

            # End of the component in the group mask (dst)
            dst_x_end = dst_x_start + comp_w
            dst_y_end = dst_y_start + comp_h

            # Since the group BBox (x, y, w, h) combines all component BBoxes,
            # we know that the component fits entirely within the group mask,
            # and no additional cropping is needed!

            # Copy the component mask into the group mask, using bitwise OR
            mask[dst_y_start:dst_y_end, dst_x_start:dst_x_end] = cv2.bitwise_or(
                mask[dst_y_start:dst_y_end, dst_x_start:dst_x_end], comp_mask
            )

        return mask

    def extract_objects(self, groups):
        """
        Extract and save objects from groups using mask-based extraction.

        Uses precise masks instead of just bounding boxes for proper transparency
        handling of non-rectangular objects close to each other.
        """
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
            # Where mask is 255 (object), alpha is 255 (opaque)
            # Where mask is 0 (background), alpha is 0 (transparent)
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

        # --- REFACTORED GROUPING LOGIC ---
        groups = []
        if self.strategy == 0: # No grouping
            groups = [{i} for i in range(len(self.components))]
        elif self.strategy == 1: # BBox Intersection (S1)
            groups = self.group_components_by_strategy("BBox Intersection", self._merge_condition_s1)
        elif self.strategy == 2: # BBox-Hull Intersection (S2)
            groups = self.group_components_by_strategy("BBox-Hull Intersection", self._merge_condition_s2)
        elif self.strategy == 3: # Hull-Hull Intersection (S3)
            groups = self.group_components_by_strategy("Hull-Hull Intersection", self._merge_condition_s3)

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
  python extract_objects.py image.jpg -s 2 -p 20 --debug
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
        choices=[0, 1, 2, 3],
        help="Grouping strategy: 0=None, 1=BBox Intersection, 2=BBox-Hull Intersection, 3=Hull-Hull Intersection (default: 1)"
    )

    parser.add_argument(
        "--padding", "-p",
        type=int,
        default=10,
        help="Padding for bounding box expansion in pixels (default: 10)"
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