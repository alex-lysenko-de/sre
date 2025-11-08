#!/usr/bin/env python3
"""
GUI Application for Interactive Object Extraction
Based on img_cutter.py ObjectExtractor
"""

import sys
import os
from pathlib import Path
from typing import List, Dict, Optional, Set
import numpy as np
import cv2

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QComboBox, QSlider, QFileDialog, QScrollArea,
    QTextEdit, QGroupBox, QProgressDialog, QMessageBox, QSplitter
)
from PyQt5.QtCore import Qt, QRect, pyqtSignal, QPoint
from PyQt5.QtGui import QPixmap, QImage, QPainter, QPen, QColor, QPolygon

# Import ObjectExtractor from img_cutter.py
try:
    from img_cutter import ObjectExtractor
except ImportError:
    print("Error: img_cutter.py not found. Please ensure it's in the same directory.")
    sys.exit(1)


class GUIController:
    """Business logic layer - bridges GUI and ObjectExtractor"""

    def __init__(self):
        self.extractor: Optional[ObjectExtractor] = None
        self.current_image: Optional[np.ndarray] = None
        self.groups: List[Dict] = []
        self.selected_groups: Set[int] = set()

    def load_image(self, file_path: str) -> bool:
        """Load and preprocess image"""
        try:
            # Create extractor with default settings
            self.extractor = ObjectExtractor(file_path, strategy=1, padding=10, debug=False)

            if not self.extractor.validate_input():
                return False

            self.extractor.create_output_directory()

            if not self.extractor.preprocess():
                return False

            # Store current image
            self.current_image = self.extractor.image.copy()

            return True

        except Exception as e:
            print(f"Error loading image: {e}")
            return False

    def find_components(self) -> bool:
        """Find connected components"""
        if not self.extractor:
            return False

        try:
            return self.extractor.find_components()
        except Exception as e:
            print(f"Error finding components: {e}")
            return False

    def group_components(self, strategy: int, padding: int) -> List[Dict]:
        """Group components and return formatted data"""
        if not self.extractor:
            return []

        try:
            # Update extractor settings
            self.extractor.strategy = strategy
            self.extractor.padding = padding

            # Run grouping based on strategy
            if strategy == 0:
                groups = [{i} for i in range(len(self.extractor.components))]
            elif strategy == 1:
                groups = self.extractor.group_components_by_strategy(
                    "BBox Intersection", self.extractor._merge_condition_s1
                )
            elif strategy == 2:
                groups = self.extractor.group_components_by_strategy(
                    "BBox-Hull Intersection", self.extractor._merge_condition_s2
                )
            elif strategy == 3:
                groups = self.extractor.group_components_by_strategy(
                    "Hull-Hull Intersection", self.extractor._merge_condition_s3
                )
            else:
                return []

            # Format groups for GUI
            self.groups = []
            for idx, group_indices in enumerate(groups):
                group_list = list(group_indices)
                bbox = self.extractor.get_group_bbox(group_list)

                # Calculate area
                area = sum(self.extractor.components[i]['area'] for i in group_list)

                self.groups.append({
                    'id': idx,
                    'bbox': bbox,
                    'indices': group_list,
                    'area': area,
                    'selected': False
                })

            # Sort by area (smaller groups rendered on top)
            self.groups.sort(key=lambda g: g['area'], reverse=True)

            return self.groups

        except Exception as e:
            print(f"Error grouping components: {e}")
            return []

    def extract_selected_groups(self, dilation: int = 2) -> bool:
        """Extract selected groups and remove them from image"""
        if not self.extractor or not self.selected_groups:
            return False

        try:
            # Extract only selected groups
            selected = [g for g in self.groups if g['id'] in self.selected_groups]

            # Extract objects
            for group in selected:
                group_indices = group['indices']
                x, y, w, h = group['bbox']

                # Get mask and crop image
                mask = self.extractor.get_group_mask(group_indices, (x, y, w, h))
                cropped = self.current_image[y:y + h, x:x + w]

                # Dilate mask if needed
                if dilation > 0:
                    kernel = np.ones((dilation, dilation), np.uint8)
                    mask = cv2.dilate(mask, kernel, iterations=1)

                # Create RGBA image
                rgba = cv2.cvtColor(cropped, cv2.COLOR_BGR2BGRA)
                rgba[:, :, 3] = mask

                # Save PNG
                output_file = self.extractor.output_dir / f"object_{group['id']:03d}.png"
                cv2.imwrite(str(output_file), rgba)

                # Remove from current image (fill with white)
                self.current_image[y:y + h, x:x + w][mask > 0] = [255, 255, 255]

            # Update extractor's image and reprocess
            self.extractor.image = self.current_image.copy()

            # CRITICAL: Regenerate grayscale and binary from updated image
            self.extractor.gray = cv2.cvtColor(self.extractor.image, cv2.COLOR_BGR2GRAY)
            _, self.extractor.binary = cv2.threshold(
                self.extractor.gray, 128, 255, cv2.THRESH_BINARY_INV
            )

            # Clear components list - they're now invalid
            self.extractor.components = []

            # Clear selection
            self.selected_groups.clear()

            return True

        except Exception as e:
            print(f"Error extracting groups: {e}")
            return False

    def toggle_group_selection(self, group_id: int):
        """Toggle selection state of a group"""
        if group_id in self.selected_groups:
            self.selected_groups.remove(group_id)
        else:
            self.selected_groups.add(group_id)

    def select_all_groups(self):
        """Select all groups"""
        self.selected_groups = {g['id'] for g in self.groups}

    def deselect_all_groups(self):
        """Deselect all groups"""
        self.selected_groups.clear()

    def merge_selected_groups(self) -> bool:
        """Merge selected groups into one"""
        if len(self.selected_groups) < 2:
            return False

        try:
            # Get all selected groups
            selected = [g for g in self.groups if g['id'] in self.selected_groups]

            # Collect all component indices from selected groups
            merged_indices = []
            for group in selected:
                merged_indices.extend(group['indices'])

            # Calculate new bounding box
            merged_bbox = self.extractor.get_group_bbox(merged_indices)

            # Calculate total area
            merged_area = sum(self.extractor.components[i]['area'] for i in merged_indices)

            # Remove selected groups and add merged one
            new_groups = [g for g in self.groups if g['id'] not in self.selected_groups]

            # Create new merged group with new ID
            new_id = max([g['id'] for g in self.groups]) + 1 if self.groups else 0
            merged_group = {
                'id': new_id,
                'bbox': merged_bbox,
                'indices': merged_indices,
                'area': merged_area,
                'selected': False
            }

            new_groups.append(merged_group)

            # Sort by area
            new_groups.sort(key=lambda g: g['area'], reverse=True)

            # Update groups
            self.groups = new_groups
            self.selected_groups.clear()

            return True

        except Exception as e:
            print(f"Error merging groups: {e}")
            return False


class ImageViewerWidget(QLabel):
    """Custom widget for image display with interaction"""

    group_clicked = pyqtSignal(int, bool)  # group_id, ctrl_pressed

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAlignment(Qt.AlignCenter)
        self.setMinimumSize(400, 400)

        self.original_image: Optional[QPixmap] = None
        self.groups: List[Dict] = []
        self.selected_groups: Set[int] = set()
        self.zoom_factor = 1.0
        self.offset = QPoint(0, 0)

        # Lasso selection
        self.lasso_start: Optional[QPoint] = None
        self.lasso_current: Optional[QPoint] = None
        self.is_lasso_active = False

    def set_image(self, image: np.ndarray):
        """Set image from numpy array"""
        height, width, channel = image.shape
        bytes_per_line = 3 * width
        q_image = QImage(image.data, width, height, bytes_per_line, QImage.Format_RGB888)
        self.original_image = QPixmap.fromImage(q_image.rgbSwapped())
        self.update_display()

    def set_groups(self, groups: List[Dict], selected: Set[int]):
        """Set groups to display"""
        self.groups = groups
        self.selected_groups = selected
        self.update()

    def update_display(self):
        """Update display with current zoom"""
        if self.original_image:
            scaled = self.original_image.scaled(
                self.original_image.size() * self.zoom_factor,
                Qt.KeepAspectRatio,
                Qt.SmoothTransformation
            )
            self.setPixmap(scaled)

    def zoom_in(self):
        """Zoom in"""
        self.zoom_factor = min(self.zoom_factor * 1.2, 5.0)
        self.update_display()
        self.update()

    def zoom_out(self):
        """Zoom out"""
        self.zoom_factor = max(self.zoom_factor / 1.2, 0.1)
        self.update_display()
        self.update()

    def paintEvent(self, event):
        """Custom paint event to draw groups"""
        super().paintEvent(event)

        if not self.original_image:
            return

        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # Calculate offset for centered image
        pixmap = self.pixmap()
        if not pixmap:
            return

        x_offset = (self.width() - pixmap.width()) // 2
        y_offset = (self.height() - pixmap.height()) // 2

        # Draw groups
        if self.groups:
            for group in self.groups:
                x, y, w, h = group['bbox']

                # Scale coordinates
                sx = int(x * self.zoom_factor) + x_offset
                sy = int(y * self.zoom_factor) + y_offset
                sw = int(w * self.zoom_factor)
                sh = int(h * self.zoom_factor)

                # Choose color based on selection
                if group['id'] in self.selected_groups:
                    color = QColor(255, 0, 0)  # Red for selected
                    width = 3
                else:
                    color = QColor(255, 255, 0)  # Yellow for unselected
                    width = 2

                pen = QPen(color, width)
                painter.setPen(pen)
                painter.drawRect(sx, sy, sw, sh)

        # Draw lasso rectangle
        if self.is_lasso_active and self.lasso_start and self.lasso_current:
            pen = QPen(QColor(0, 255, 255), 2, Qt.DashLine)  # Cyan dashed line
            painter.setPen(pen)

            x1 = min(self.lasso_start.x(), self.lasso_current.x())
            y1 = min(self.lasso_start.y(), self.lasso_current.y())
            x2 = max(self.lasso_start.x(), self.lasso_current.x())
            y2 = max(self.lasso_start.y(), self.lasso_current.y())

            painter.drawRect(x1, y1, x2 - x1, y2 - y1)

    def mousePressEvent(self, event):
        """Handle mouse press - start lasso selection"""
        if not self.pixmap() or event.button() != Qt.LeftButton:
            return

        # Start lasso selection
        self.lasso_start = event.pos()
        self.lasso_current = event.pos()
        self.is_lasso_active = True
        self.update()

    def mouseMoveEvent(self, event):
        """Handle mouse move - update lasso"""
        if self.is_lasso_active:
            self.lasso_current = event.pos()
            self.update()

    def mouseReleaseEvent(self, event):
        """Handle mouse release - complete lasso selection"""
        if not self.is_lasso_active or event.button() != Qt.LeftButton:
            return

        self.is_lasso_active = False

        if not self.lasso_start or not self.lasso_current or not self.groups:
            self.lasso_start = None
            self.lasso_current = None
            self.update()
            return

        # Calculate lasso rectangle
        x1 = min(self.lasso_start.x(), self.lasso_current.x())
        y1 = min(self.lasso_start.y(), self.lasso_current.y())
        x2 = max(self.lasso_start.x(), self.lasso_current.x())
        y2 = max(self.lasso_start.y(), self.lasso_current.y())

        # Check if it's a click (very small drag) or a real lasso
        drag_distance = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5

        if drag_distance < 5:  # Click threshold - 5 pixels
            # It's a click - toggle single group
            pixmap = self.pixmap()
            if pixmap:
                x_offset = (self.width() - pixmap.width()) // 2
                y_offset = (self.height() - pixmap.height()) // 2

                click_x = (x1 - x_offset) / self.zoom_factor
                click_y = (y1 - y_offset) / self.zoom_factor

                # Find clicked group (check from smallest to largest)
                for group in reversed(self.groups):
                    gx, gy, gw, gh = group['bbox']
                    if gx <= click_x <= gx + gw and gy <= click_y <= gy + gh:
                        self.group_clicked.emit(group['id'], False)
                        break
        else:
            # It's a lasso - select all groups in rectangle
            pixmap = self.pixmap()
            if pixmap:
                x_offset = (self.width() - pixmap.width()) // 2
                y_offset = (self.height() - pixmap.height()) // 2

                img_x1 = (x1 - x_offset) / self.zoom_factor
                img_y1 = (y1 - y_offset) / self.zoom_factor
                img_x2 = (x2 - x_offset) / self.zoom_factor
                img_y2 = (y2 - y_offset) / self.zoom_factor

                # Select all groups that intersect with lasso
                for group in self.groups:
                    gx, gy, gw, gh = group['bbox']

                    # Check if group bbox intersects with lasso rectangle
                    if not (gx + gw < img_x1 or gx > img_x2 or
                            gy + gh < img_y1 or gy > img_y2):
                        self.group_clicked.emit(group['id'], True)  # True = add to selection

        self.lasso_start = None
        self.lasso_current = None
        self.update()


class MainWindow(QMainWindow):
    """Main application window"""

    def __init__(self):
        super().__init__()
        self.controller = GUIController()
        self.init_ui()

    def init_ui(self):
        """Initialize user interface"""
        self.setWindowTitle("Object Extraction Tool")
        self.setGeometry(100, 100, 1200, 800)

        # Central widget
        central = QWidget()
        self.setCentralWidget(central)

        # Main layout
        main_layout = QHBoxLayout(central)

        # Left panel - controls
        left_panel = self.create_control_panel()

        # Right panel - image viewer and log
        right_panel = self.create_viewer_panel()

        # Add to splitter
        splitter = QSplitter(Qt.Horizontal)
        splitter.addWidget(left_panel)
        splitter.addWidget(right_panel)
        splitter.setSizes([300, 900])

        main_layout.addWidget(splitter)

    def create_control_panel(self) -> QWidget:
        """Create control panel"""
        panel = QWidget()
        layout = QVBoxLayout(panel)

        # Load image button
        self.btn_load = QPushButton("Load Image")
        self.btn_load.clicked.connect(self.on_load_image)
        layout.addWidget(self.btn_load)



        # Strategy group
        strategy_group = QGroupBox("Grouping Strategy")
        strategy_layout = QVBoxLayout()

        self.strategy_combo = QComboBox()
        self.strategy_combo.addItems([
            "0 - No Grouping",
            "1 - BBox Intersection",
            "2 - BBox-Hull Intersection",
            "3 - Hull-Hull Intersection"
        ])
        self.strategy_combo.setCurrentIndex(1)
        strategy_layout.addWidget(self.strategy_combo)

        strategy_group.setLayout(strategy_layout)
        layout.addWidget(strategy_group)

        # Padding group
        padding_group = QGroupBox("Padding")
        padding_layout = QVBoxLayout()

        self.padding_slider = QSlider(Qt.Horizontal)
        self.padding_slider.setMinimum(0)
        self.padding_slider.setMaximum(100)
        self.padding_slider.setValue(10)
        self.padding_slider.valueChanged.connect(self.on_padding_changed)

        self.padding_label = QLabel("Value: 10")

        padding_layout.addWidget(self.padding_label)
        padding_layout.addWidget(self.padding_slider)

        padding_group.setLayout(padding_layout)
        layout.addWidget(padding_group)

        # Group button
        self.btn_find = QPushButton("Find and group Components")
        self.btn_find.clicked.connect(self.on_find_and_group)
        self.btn_find.setEnabled(False)
        layout.addWidget(self.btn_find)

        # Selection buttons
        selection_group = QGroupBox("Selection")
        selection_layout = QVBoxLayout()

        self.btn_select_all = QPushButton("Select All")
        self.btn_select_all.clicked.connect(self.on_select_all)
        self.btn_select_all.setEnabled(False)

        self.btn_deselect_all = QPushButton("Deselect All")
        self.btn_deselect_all.clicked.connect(self.on_deselect_all)
        self.btn_deselect_all.setEnabled(False)

        self.btn_merge = QPushButton("Merge Selected")
        self.btn_merge.clicked.connect(self.on_merge_selected)
        self.btn_merge.setEnabled(False)

        selection_layout.addWidget(self.btn_select_all)
        selection_layout.addWidget(self.btn_deselect_all)
        selection_layout.addWidget(self.btn_merge)

        selection_group.setLayout(selection_layout)
        layout.addWidget(selection_group)

        # Extract button
        self.btn_extract = QPushButton("Extract Selected")
        self.btn_extract.clicked.connect(self.on_extract_selected)
        self.btn_extract.setEnabled(False)
        layout.addWidget(self.btn_extract)

        # Zoom buttons
        zoom_group = QGroupBox("Zoom")
        zoom_layout = QHBoxLayout()

        self.btn_zoom_in = QPushButton("+")
        self.btn_zoom_in.clicked.connect(self.on_zoom_in)

        self.btn_zoom_out = QPushButton("-")
        self.btn_zoom_out.clicked.connect(self.on_zoom_out)

        zoom_layout.addWidget(self.btn_zoom_in)
        zoom_layout.addWidget(self.btn_zoom_out)

        zoom_group.setLayout(zoom_layout)
        layout.addWidget(zoom_group)

        layout.addStretch()

        return panel

    def create_viewer_panel(self) -> QWidget:
        """Create viewer panel"""
        panel = QWidget()
        layout = QVBoxLayout(panel)

        # Image viewer
        scroll = QScrollArea()
        self.image_viewer = ImageViewerWidget()
        self.image_viewer.group_clicked.connect(self.on_group_clicked)
        scroll.setWidget(self.image_viewer)
        scroll.setWidgetResizable(True)

        layout.addWidget(scroll, 3)

        # Log panel
        log_group = QGroupBox("Log")
        log_layout = QVBoxLayout()

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(150)

        log_layout.addWidget(self.log_text)
        log_group.setLayout(log_layout)

        layout.addWidget(log_group, 1)

        return panel

    def log(self, message: str):
        """Add message to log"""
        self.log_text.append(message)

    def on_load_image(self):
        """Handle load image button"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Open Image", "", "Images (*.png *.jpg *.jpeg *.bmp)"
        )

        if not file_path:
            return

        self.log(f"Loading: {file_path}")

        # CRITICAL: Clear all previous data before loading new image
        self.controller.groups = []
        self.controller.selected_groups.clear()

        # Clear viewer
        self.image_viewer.set_groups([], set())

        # Reset all buttons to initial state
        self.btn_find.setEnabled(False)
        self.btn_select_all.setEnabled(False)
        self.btn_deselect_all.setEnabled(False)
        self.btn_merge.setEnabled(False)
        self.btn_extract.setEnabled(False)

        if not self.controller.load_image(file_path):
            QMessageBox.critical(self, "Error", "Failed to load image")
            return

        self.log("Image loaded successfully")

        # Display image
        self.image_viewer.set_image(self.controller.current_image)

        # Enable find button
        self.btn_find.setEnabled(True)
        self.log("Click 'Find components' to detect components")

    def on_padding_changed(self, value: int):
        """Handle padding slider change"""
        self.padding_label.setText(f"Value: {value}")

    def on_find_and_group(self):
        """Handle find and group button"""
        self.on_find_components()
        self.on_group_components()

    def on_find_components(self):
        """Handle find components button"""
        self.log("Finding components...")

        if not self.controller.find_components():
            self.log("No components found")
            QMessageBox.information(self, "Info", "No components found in image")
            return

        num_components = len(self.controller.extractor.components)
        self.log(f"Found {num_components} components")

        # Visualize components with bounding boxes (yellow)
        # Create temporary groups for visualization (each component is its own group)
        temp_groups = []
        for idx, comp in enumerate(self.controller.extractor.components):
            temp_groups.append({
                'id': idx,
                'bbox': comp['bbox'],
                'indices': [idx],
                'area': comp['area'],
                'selected': False
            })

        self.image_viewer.set_groups(temp_groups, set())

        # Enable grouping

        self.log("Click 'Group Components' to group them")

    def on_group_components(self):
        """Handle group button"""
        strategy = self.strategy_combo.currentIndex()
        padding = self.padding_slider.value()

        self.log(f"Grouping with strategy {strategy}, padding {padding}...")

        # Show progress
        progress = QProgressDialog("Grouping components...", None, 0, 0, self)
        progress.setWindowModality(Qt.WindowModal)
        progress.show()
        QApplication.processEvents()

        groups = self.controller.group_components(strategy, padding)

        progress.close()

        if groups:
            self.log(f"Created {len(groups)} groups")
            self.image_viewer.set_groups(groups, self.controller.selected_groups)
            self.btn_select_all.setEnabled(True)
            self.btn_deselect_all.setEnabled(True)
            self.btn_merge.setEnabled(True)
            self.btn_extract.setEnabled(True)
        else:
            self.log("No groups created")

    def on_group_clicked(self, group_id: int, add_to_selection: bool):
        """Handle group click in viewer"""
        if add_to_selection:
            # Add to selection (from lasso)
            self.controller.selected_groups.add(group_id)
        else:
            # Toggle selection (from click)
            self.controller.toggle_group_selection(group_id)

        self.image_viewer.set_groups(self.controller.groups, self.controller.selected_groups)

        count = len(self.controller.selected_groups)
        self.log(f"Selected groups: {count}")

    def on_select_all(self):
        """Handle select all button"""
        self.controller.select_all_groups()
        self.image_viewer.set_groups(self.controller.groups, self.controller.selected_groups)
        self.log(f"Selected all {len(self.controller.selected_groups)} groups")

    def on_deselect_all(self):
        """Handle deselect all button"""
        self.controller.deselect_all_groups()
        self.image_viewer.set_groups(self.controller.groups, self.controller.selected_groups)
        self.log("Deselected all groups")

    def on_merge_selected(self):
        """Handle merge selected button"""
        if len(self.controller.selected_groups) < 2:
            QMessageBox.warning(self, "Warning", "Select at least 2 groups to merge")
            return

        count = len(self.controller.selected_groups)
        reply = QMessageBox.question(
            self, "Confirm",
            f"Merge {count} selected groups into one?",
            QMessageBox.Yes | QMessageBox.No
        )

        if reply != QMessageBox.Yes:
            return

        self.log(f"Merging {count} groups...")

        if self.controller.merge_selected_groups():
            self.log("Groups merged successfully")
            self.image_viewer.set_groups(self.controller.groups, self.controller.selected_groups)
        else:
            QMessageBox.critical(self, "Error", "Failed to merge groups")

    def on_extract_selected(self):
        """Handle extract button"""
        if not self.controller.selected_groups:
            QMessageBox.warning(self, "Warning", "No groups selected")
            return

        count = len(self.controller.selected_groups)
        reply = QMessageBox.question(
            self, "Confirm",
            f"Extract {count} selected group(s)?",
            QMessageBox.Yes | QMessageBox.No
        )

        if reply != QMessageBox.Yes:
            return

        self.log(f"Extracting {count} groups...")

        if self.controller.extract_selected_groups():
            self.log("Extraction complete")

            # Update display
            self.image_viewer.set_image(self.controller.current_image)

            # Clear current groups visualization
            self.controller.groups = []
            self.image_viewer.set_groups([], set())

            # Reset buttons - user needs to click "Find components" again
            self.btn_select_all.setEnabled(False)
            self.btn_deselect_all.setEnabled(False)
            self.btn_merge.setEnabled(False)
            self.btn_extract.setEnabled(False)

            self.log("Click 'Find components' to detect remaining components")
        else:
            QMessageBox.critical(self, "Error", "Extraction failed")

    def on_zoom_in(self):
        """Handle zoom in"""
        self.image_viewer.zoom_in()

    def on_zoom_out(self):
        """Handle zoom out"""
        self.image_viewer.zoom_out()


def main():
    """Main entry point"""
    app = QApplication(sys.argv)

    # Set application style
    app.setStyle('Fusion')

    window = MainWindow()
    window.show()

    sys.exit(app.exec_())


if __name__ == "__main__":
    main()