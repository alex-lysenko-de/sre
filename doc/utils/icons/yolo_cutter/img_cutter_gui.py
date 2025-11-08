"""
Interactive GUI for object extraction and segmentation.
Built with PySide6, integrates ObjectExtractor from img_cutter.py
"""

import sys
import os
import io
import threading
from pathlib import Path
from typing import List, Set, Optional, Tuple
from dataclasses import dataclass

import numpy as np
import cv2
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QComboBox, QSlider, QLabel, QFileDialog, QGraphicsView,
    QGraphicsScene, QGraphicsItem, QGraphicsRectItem, QGraphicsPolygonItem,
    QProgressDialog, QTextEdit, QSplitter, QGridLayout, QScrollArea,
    QCheckBox, QMessageBox
)
from PySide6.QtCore import Qt, QSize, QRect, QTimer, Signal, QObject, QPointF
from PySide6.QtGui import (
    QPixmap, QImage, QPainter, QPen, QColor, QBrush, QFont,
    QPolygonF, QTransform
)
from PySide6.QtWidgets import QGroupBox

from img_cutter import ObjectExtractor


@dataclass
class GroupData:
    """Data structure for a group of components."""
    group_id: int
    component_indices: Set[int]
    bbox: Tuple[int, int, int, int]
    is_selected: bool = False
    color: QColor = None


class WorkerThread(QObject):
    """Worker thread for long-running operations."""
    finished = Signal()
    error = Signal(str)

    def __init__(self, task_func):
        super().__init__()
        self.task_func = task_func

    def run(self):
        try:
            self.task_func()
            self.finished.emit()
        except Exception as e:
            self.error.emit(str(e))


class GroupGraphicsItem(QGraphicsItem):
    """Visual representation of a group."""

    def __init__(self, group_data: GroupData, extractor: ObjectExtractor, color: QColor):
        super().__init__()
        self.group_data = group_data
        self.extractor = extractor
        self.color = color
        self.setAcceptHoverEvents(True)
        self.setZValue(-group_data.bbox[2] * group_data.bbox[3])  # Smaller on top

    def boundingRect(self):
        x, y, w, h = self.group_data.bbox
        return QRect(x, y, w, h)

    def paint(self, painter, option, widget=None):
        x, y, w, h = self.group_data.bbox
        rect = QRect(0, 0, w, h)

        if self.group_data.is_selected:
            pen = QPen(QColor(255, 0, 0), 3)
        else:
            pen = QPen(self.color, 2)

        painter.setPen(pen)
        painter.drawRect(rect)

        # Draw label
        font = QFont()
        font.setPointSize(8)
        painter.setFont(font)
        painter.setPen(QColor(0, 0, 0))
        painter.drawText(rect.adjusted(2, 2, 0, 0), f"G{self.group_data.group_id}")

    def mousePressEvent(self, event):
        self.group_data.is_selected = not self.group_data.is_selected
        self.update()


class ImageGraphicsView(QGraphicsView):
    """Custom graphics view for image display and interaction."""

    group_selected = Signal(int, bool)  # group_id, is_selected

    def __init__(self, scene: QGraphicsScene):
        super().__init__(scene)
        self.groups: List[GroupData] = []
        self.lasso_start = None
        self.lasso_rect = None
        self.setDragMode(QGraphicsView.ScrollHandDrag)
        self.setRenderHint(QPainter.Antialiasing)

    def wheelEvent(self, event):
        """Zoom with mouse wheel."""
        factor = 1.1 if event.angleDelta().y() > 0 else 0.9
        self.scale(factor, factor)

    def mousePressEvent(self, event):
        if event.modifiers() & Qt.ControlModifier:
            self.lasso_start = self.mapToScene(event.pos())
        else:
            super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self.lasso_start:
            pos = self.mapToScene(event.pos())
            if self.lasso_rect:
                self.scene().removeItem(self.lasso_rect)
            x1, y1 = self.lasso_start.x(), self.lasso_start.y()
            x2, y2 = pos.x(), pos.y()
            self.lasso_rect = self.scene().addRect(
                min(x1, x2), min(y1, y2), abs(x2 - x1), abs(y2 - y1),
                QPen(QColor(0, 255, 0), 1)
            )
        else:
            super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        if self.lasso_start:
            if self.lasso_rect:
                self.scene().removeItem(self.lasso_rect)
            pos = self.mapToScene(event.pos())
            lasso_rect = QRect(
                int(self.lasso_start.x()), int(self.lasso_start.y()),
                int(pos.x() - self.lasso_start.x()), int(pos.y() - self.lasso_start.y())
            )
            for group in self.groups:
                gx, gy, gw, gh = group.bbox
                if lasso_rect.intersects(QRect(gx, gy, gw, gh)):
                    group.is_selected = not group.is_selected
            self.lasso_start = None
            self.lasso_rect = None
            self.redraw_groups()
        else:
            super().mouseReleaseEvent(event)

    def redraw_groups(self):
        """Redraw all group items."""
        for item in self.scene().items():
            if isinstance(item, GroupGraphicsItem):
                item.update()


class ObjectExtractorGUI(QMainWindow):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Object Extraction Tool")
        self.setGeometry(100, 100, 1400, 900)

        self.extractor: Optional[ObjectExtractor] = None
        self.current_image = None
        self.groups: List[GroupData] = []
        self.log_messages = []

        self.init_ui()

    def init_ui(self):
        """Initialize user interface."""
        main_widget = QWidget()
        main_layout = QHBoxLayout()

        # Left panel - controls
        left_panel = QWidget()
        left_layout = QVBoxLayout()

        # Load image
        load_btn = QPushButton("Load Image")
        load_btn.clicked.connect(self.load_image)
        left_layout.addWidget(load_btn)

        # Strategy selection
        left_layout.addWidget(QLabel("Grouping Strategy:"))
        self.strategy_combo = QComboBox()
        self.strategy_combo.addItems([
            "0 - No Grouping",
            "1 - BBox Intersection",
            "2 - BBox-Hull Intersection",
            "3 - Hull-Hull Intersection"
        ])
        self.strategy_combo.setCurrentIndex(1)
        left_layout.addWidget(self.strategy_combo)

        # Padding slider
        left_layout.addWidget(QLabel("Padding (0-100):"))
        self.padding_slider = QSlider(Qt.Horizontal)
        self.padding_slider.setRange(0, 100)
        self.padding_slider.setValue(10)
        self.padding_slider.setTickPosition(QSlider.TicksBelow)
        self.padding_label = QLabel("10")
        left_layout.addWidget(self.padding_slider)
        left_layout.addWidget(self.padding_label)
        self.padding_slider.sliderMoved.connect(self.update_padding_label)

        # Dilation slider
        left_layout.addWidget(QLabel("Mask Dilation (0-5 px):"))
        self.dilation_slider = QSlider(Qt.Horizontal)
        self.dilation_slider.setRange(0, 5)
        self.dilation_slider.setValue(1)
        left_layout.addWidget(self.dilation_slider)

        # Group button
        group_btn = QPushButton("Group Components")
        group_btn.clicked.connect(self.group_components)
        left_layout.addWidget(group_btn)

        # Extract button
        extract_btn = QPushButton("Extract Selected")
        extract_btn.clicked.connect(self.extract_selected)
        left_layout.addWidget(extract_btn)

        # Selection controls
        left_layout.addWidget(QLabel("\nSelection:"))
        select_all_btn = QPushButton("Select All")
        select_all_btn.clicked.connect(self.select_all_groups)
        left_layout.addWidget(select_all_btn)

        deselect_all_btn = QPushButton("Deselect All")
        deselect_all_btn.clicked.connect(self.deselect_all_groups)
        left_layout.addWidget(deselect_all_btn)

        merge_btn = QPushButton("Merge Selected Groups")
        merge_btn.clicked.connect(self.merge_selected_groups)
        left_layout.addWidget(merge_btn)

        left_layout.addStretch()

        left_panel.setLayout(left_layout)
        left_panel.setMaximumWidth(250)

        # Right panel - graphics view and log
        right_layout = QVBoxLayout()

        # Graphics view
        self.scene = QGraphicsScene()
        self.graphics_view = ImageGraphicsView(self.scene)
        right_layout.addWidget(self.graphics_view)

        # Log panel
        log_label = QLabel("Log:")
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(150)
        right_layout.addWidget(log_label)
        right_layout.addWidget(self.log_text)

        right_widget = QWidget()
        right_widget.setLayout(right_layout)

        main_layout.addWidget(left_panel)
        main_layout.addWidget(right_widget, 1)

        main_widget.setLayout(main_layout)
        self.setCentralWidget(main_widget)

    def load_image(self):
        """Load image file."""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Select Image", "", "Images (*.png *.jpg *.jpeg *.bmp)"
        )
        if not file_path:
            return

        try:
            self.extractor = ObjectExtractor(file_path, strategy=1, padding=10, debug=False)
            if not self.extractor.validate_input():
                QMessageBox.critical(self, "Error", "Failed to validate input")
                return

            self.extractor.create_output_directory()
            if not self.extractor.preprocess():
                QMessageBox.critical(self, "Error", "Failed to preprocess image")
                return

            self.current_image = self.extractor.image.copy()
            self.display_image()

            self.log_message("Image loaded successfully")

            # Auto-find components
            if self.extractor.find_components():
                self.log_message(f"Found {len(self.extractor.components)} components")
                # Auto-group
                self.group_components()
            else:
                self.log_message("No components found")

        except Exception as e:
            self.log_message(f"ERROR: {str(e)}")
            QMessageBox.critical(self, "Error", f"Failed to load image: {str(e)}")

    def display_image(self):
        """Display current image in graphics view."""
        if self.current_image is None:
            return

        h, w = self.current_image.shape[:2]
        bgr = self.current_image
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        h, w, ch = rgb.shape
        bytes_per_line = 3 * w
        qt_image = QImage(rgb.data, w, h, bytes_per_line, QImage.Format_RGB888)
        pixmap = QPixmap.fromImage(qt_image)

        self.scene.clear()
        self.scene.addPixmap(pixmap)

    def update_padding_label(self):
        """Update padding label."""
        self.padding_label.setText(str(self.padding_slider.value()))

    def group_components(self):
        """Group components by selected strategy."""
        if self.extractor is None or len(self.extractor.components) == 0:
            QMessageBox.warning(self, "Warning", "No components to group")
            return

        strategy = self.strategy_combo.currentIndex()
        padding = self.padding_slider.value()

        self.log_message(f"Grouping with strategy {strategy}, padding {padding}...")

        try:
            self.extractor.strategy = strategy
            self.extractor.padding = padding

            groups = []
            if strategy == 0:
                groups = [set([i]) for i in range(len(self.extractor.components))]
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

            self.groups = []
            colors = [
                QColor(255, 255, 0), QColor(0, 255, 255), QColor(255, 0, 255),
                QColor(0, 255, 0), QColor(255, 165, 0), QColor(100, 200, 255)
            ]

            for i, group_indices in enumerate(groups):
                bbox = self.extractor.get_group_bbox(list(group_indices))
                group_data = GroupData(
                    group_id=i + 1,
                    component_indices=group_indices,
                    bbox=bbox,
                    color=colors[i % len(colors)]
                )
                self.groups.append(group_data)

            self.visualize_groups()
            self.log_message(f"Grouped into {len(self.groups)} group(s)")

        except Exception as e:
            self.log_message(f"ERROR during grouping: {str(e)}")
            QMessageBox.critical(self, "Error", f"Grouping failed: {str(e)}")

    def visualize_groups(self):
        """Draw groups on the graphics view."""
        self.display_image()
        for group in self.groups:
            item = GroupGraphicsItem(group, self.extractor, group.color)
            item.setPos(group.bbox[0], group.bbox[1])
            self.scene.addItem(item)
        self.graphics_view.groups = self.groups

    def select_all_groups(self):
        """Select all groups."""
        for group in self.groups:
            group.is_selected = True
        self.visualize_groups()

    def deselect_all_groups(self):
        """Deselect all groups."""
        for group in self.groups:
            group.is_selected = False
        self.visualize_groups()

    def merge_selected_groups(self):
        """Merge selected groups into one."""
        selected = [g for g in self.groups if g.is_selected]
        if len(selected) < 2:
            QMessageBox.warning(self, "Warning", "Select at least 2 groups to merge")
            return

        merged_indices = set()
        for g in selected:
            merged_indices.update(g.component_indices)

        for g in selected:
            self.groups.remove(g)

        new_group = GroupData(
            group_id=max(g.group_id for g in self.groups) + 1 if self.groups else 1,
            component_indices=merged_indices,
            bbox=self.extractor.get_group_bbox(list(merged_indices)),
            color=QColor(255, 0, 0)
        )
        self.groups.append(new_group)
        self.visualize_groups()
        self.log_message(f"Merged {len(selected)} groups")

    def extract_selected(self):
        """Extract selected groups."""
        selected = [g for g in self.groups if g.is_selected]
        if not selected:
            QMessageBox.warning(self, "Warning", "Select at least one group to extract")
            return

        try:
            dilation = self.dilation_slider.value()
            self.log_message(f"Extracting {len(selected)} group(s) with dilation {dilation}...")

            for group in selected:
                indices = list(group.component_indices)
                x, y, w, h = self.extractor.get_group_bbox(indices)

                if w <= 0 or h <= 0:
                    continue

                mask = self.extractor.get_group_mask(indices, (x, y, w, h))

                if dilation > 0:
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilation * 2 + 1, dilation * 2 + 1))
                    mask = cv2.dilate(mask, kernel, iterations=1)

                cropped = self.current_image[y:y + h, x:x + w]
                rgba = cv2.cvtColor(cropped, cv2.COLOR_BGR2BGRA)
                rgba[:, :, 3] = mask

                output_file = self.extractor.output_dir / f"object_{len(selected):03d}.png"
                cv2.imwrite(str(output_file), rgba)

                # Remove from current image
                self.current_image[y:y + h, x:x + w] = 255

            self.display_image()
            self.groups = [g for g in self.groups if not g.is_selected]
            self.visualize_groups()

            # Re-find components
            if self.extractor.find_components():
                self.log_message(f"Updated: {len(self.extractor.components)} components remaining")
            else:
                self.log_message("No components remaining")

        except Exception as e:
            self.log_message(f"ERROR during extraction: {str(e)}")
            QMessageBox.critical(self, "Error", f"Extraction failed: {str(e)}")

    def log_message(self, message: str):
        """Add message to log."""
        self.log_messages.append(message)
        self.log_text.append(message)


def main():
    app = QApplication(sys.argv)
    gui = ObjectExtractorGUI()
    gui.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()