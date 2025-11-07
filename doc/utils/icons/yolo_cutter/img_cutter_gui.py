"""
Графический интерфейс для интерактивного извлечения объектов из изображения.
GUI for img_cutter.py with interactive object extraction and grouping.
"""

import sys
import os
from pathlib import Path
import numpy as np
import cv2
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QSlider, QComboBox, QFileDialog,
    QGraphicsView, QGraphicsScene, QGraphicsPixmapItem, QTextEdit,
    QGraphicsRectItem, QGraphicsPolygonItem, QMessageBox
)
from PyQt5.QtCore import Qt, QRectF, QPointF, pyqtSignal
from PyQt5.QtGui import QPixmap, QImage, QPen, QColor, QBrush, QPolygonF, QPainter
from img_cutter import ObjectExtractor


class InteractiveGraphicsView(QGraphicsView):
    """Custom QGraphicsView with selection support."""
    
    selectionChanged = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setDragMode(QGraphicsView.RubberBandDrag)
        self.setRenderHint(QPainter.Antialiasing)
        self.setRenderHint(QPainter.SmoothPixmapTransform)
        self.selection_start = None
        self.selection_rect = None
        self.groups_items = []  # List of (group_indices, graphics_item)
        
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            scene_pos = self.mapToScene(event.pos())
            
            # Check if clicked on a group
            clicked_group = None
            for group_indices, item in self.groups_items:
                if item.contains(item.mapFromScene(scene_pos)):
                    clicked_group = group_indices
                    break
            
            if clicked_group is not None:
                # Toggle selection for this group
                if clicked_group in self.scene().selected_groups:
                    self.scene().selected_groups.remove(clicked_group)
                else:
                    self.scene().selected_groups.add(clicked_group)
                self.selectionChanged.emit()
                return
            
            # Start rubber band selection
            self.selection_start = scene_pos
        
        super().mousePressEvent(event)
    
    def mouseReleaseEvent(self, event):
        if event.button() == Qt.LeftButton and self.selection_start is not None:
            scene_end = self.mapToScene(event.pos())
            selection_rect = QRectF(self.selection_start, scene_end).normalized()
            
            # Toggle selection for all groups intersecting with selection rect
            for group_indices, item in self.groups_items:
                if item.sceneBoundingRect().intersects(selection_rect):
                    if group_indices in self.scene().selected_groups:
                        self.scene().selected_groups.remove(group_indices)
                    else:
                        self.scene().selected_groups.add(group_indices)
            
            self.selection_start = None
            self.selectionChanged.emit()
        
        super().mouseReleaseEvent(event)


class ImageScene(QGraphicsScene):
    """Custom scene to hold image and groups."""
    
    def __init__(self):
        super().__init__()
        self.selected_groups = set()  # Set of frozensets


class MainWindow(QMainWindow):
    """Main application window."""
    
    def __init__(self):
        super().__init__()
        self.extractor = None
        self.image_path = None
        self.groups = []
        self.group_graphics = []
        
        self.init_ui()
    
    def init_ui(self):
        """Initialize user interface."""
        self.setWindowTitle("Object Extractor - Interactive GUI")
        self.setGeometry(100, 100, 1400, 900)
        
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QHBoxLayout(central_widget)
        
        # Left panel - controls
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_panel.setMaximumWidth(300)
        
        # Open file button
        self.btn_open = QPushButton("Открыть изображение")
        self.btn_open.clicked.connect(self.open_image)
        left_layout.addWidget(self.btn_open)
        
        # Strategy selector
        left_layout.addWidget(QLabel("Стратегия группировки:"))
        self.combo_strategy = QComboBox()
        self.combo_strategy.addItems([
            "0 — Без группировки",
            "1 — BBox Intersection",
            "2 — BBox-Hull Intersection",
            "3 — Hull-Hull Intersection"
        ])
        self.combo_strategy.setCurrentIndex(1)
        self.combo_strategy.currentIndexChanged.connect(self.on_strategy_changed)
        left_layout.addWidget(self.combo_strategy)
        
        # Padding slider
        left_layout.addWidget(QLabel("Padding:"))
        self.slider_padding = QSlider(Qt.Horizontal)
        self.slider_padding.setMinimum(0)
        self.slider_padding.setMaximum(100)
        self.slider_padding.setValue(50)  # Middle = 10 (default)
        self.slider_padding.valueChanged.connect(self.on_padding_changed)
        left_layout.addWidget(self.slider_padding)
        
        self.label_padding = QLabel("Padding: 10")
        left_layout.addWidget(self.label_padding)
        
        # Group button
        self.btn_group = QPushButton("Группировать")
        self.btn_group.clicked.connect(self.apply_grouping)
        self.btn_group.setEnabled(False)
        left_layout.addWidget(self.btn_group)
        
        # Extract button
        self.btn_extract = QPushButton("Извлечь картинки")
        self.btn_extract.clicked.connect(self.extract_selected)
        self.btn_extract.setEnabled(False)
        left_layout.addWidget(self.btn_extract)
        
        # Stats label
        self.label_stats = QLabel("Загрузите изображение")
        self.label_stats.setWordWrap(True)
        left_layout.addWidget(self.label_stats)
        
        left_layout.addStretch()
        
        # Right side - view and log
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        
        # Graphics view
        self.scene = ImageScene()
        self.view = InteractiveGraphicsView()
        self.view.setScene(self.scene)
        self.view.selectionChanged.connect(self.update_visualization)
        right_layout.addWidget(self.view, stretch=3)
        
        # Log console
        log_label = QLabel("Консоль:")
        right_layout.addWidget(log_label)
        
        self.log_console = QTextEdit()
        self.log_console.setReadOnly(True)
        self.log_console.setMaximumHeight(150)
        right_layout.addWidget(self.log_console)
        
        # Add panels to main layout
        main_layout.addWidget(left_panel)
        main_layout.addWidget(right_widget, stretch=1)
        
        self.log("Приложение запущено. Откройте изображение для начала работы.")
    
    def log(self, message):
        """Add message to log console."""
        self.log_console.append(message)
    
    def padding_value_from_slider(self, slider_val):
        """Convert slider value (0-100) to padding using logarithmic scale."""
        if slider_val == 0:
            return 0
        # Logarithmic scale: 0-100 -> 0-100 with emphasis on small values
        # Formula: padding = 10^(slider_val/50) - 1
        # This gives: 0->0, 50->9, 100->99
        padding = int(10 ** (slider_val / 50.0) - 1)
        return max(0, min(100, padding))
    
    def open_image(self):
        """Open image file dialog."""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Выберите изображение",
            "",
            "Images (*.png *.jpg *.jpeg *.bmp)"
        )
        
        if not file_path:
            return
        
        self.image_path = file_path
        self.log(f"Загружено: {file_path}")
        
        # Create extractor
        strategy = self.combo_strategy.currentIndex()
        padding = self.padding_value_from_slider(self.slider_padding.value())
        
        self.extractor = ObjectExtractor(file_path, strategy, padding, debug=True)
        
        # Preprocess
        if not self.extractor.preprocess():
            self.log("ОШИБКА: Не удалось обработать изображение")
            return
        
        # Create output directory
        self.extractor.create_output_directory()
        
        # Find components
        self.log("Поиск фрагментов...")
        if not self.extractor.find_components():
            self.log("ВНИМАНИЕ: Компоненты не найдены")
            return
        
        self.log(f"Найдено компонентов: {len(self.extractor.components)}")
        
        # Display image
        self.display_image()
        
        # Auto-group with default settings
        self.apply_grouping()
        
        # Enable controls
        self.btn_group.setEnabled(True)
        self.btn_extract.setEnabled(True)
    
    def display_image(self):
        """Display image in graphics view."""
        if self.extractor is None or self.extractor.image is None:
            return
        
        # Convert OpenCV BGR to RGB
        image_rgb = cv2.cvtColor(self.extractor.image, cv2.COLOR_BGR2RGB)
        h, w, ch = image_rgb.shape
        bytes_per_line = ch * w
        
        q_image = QImage(image_rgb.data, w, h, bytes_per_line, QImage.Format_RGB888)
        pixmap = QPixmap.fromImage(q_image)
        
        self.scene.clear()
        self.scene.selected_groups = set()
        self.scene.addPixmap(pixmap)
        self.scene.setSceneRect(0, 0, w, h)
        
        self.view.fitInView(self.scene.sceneRect(), Qt.KeepAspectRatio)
    
    def on_strategy_changed(self, index):
        """Handle strategy change."""
        if self.extractor is not None:
            self.log(f"Изменена стратегия: {self.combo_strategy.currentText()}")
    
    def on_padding_changed(self, value):
        """Handle padding slider change."""
        padding = self.padding_value_from_slider(value)
        self.label_padding.setText(f"Padding: {padding}")
        
        if self.extractor is not None:
            self.extractor.padding = padding
    
    def apply_grouping(self):
        """Apply current grouping strategy."""
        if self.extractor is None:
            return
        
        strategy = self.combo_strategy.currentIndex()
        padding = self.padding_value_from_slider(self.slider_padding.value())
        
        self.extractor.strategy = strategy
        self.extractor.padding = padding
        
        self.log(f"Группировка: Стратегия {strategy}, Padding {padding}")
        
        # Apply grouping
        if strategy == 0:
            self.groups = [{i} for i in range(len(self.extractor.components))]
        elif strategy == 1:
            self.groups = self.extractor.group_components_by_strategy(
                "BBox Intersection", self.extractor._merge_condition_s1
            )
        elif strategy == 2:
            self.groups = self.extractor.group_components_by_strategy(
                "BBox-Hull Intersection", self.extractor._merge_condition_s2
            )
        elif strategy == 3:
            self.groups = self.extractor.group_components_by_strategy(
                "Hull-Hull Intersection", self.extractor._merge_condition_s3
            )
        
        self.log(f"Создано групп: {len(self.groups)}")
        
        # Select all groups by default
        self.scene.selected_groups = set(frozenset(g) for g in self.groups)
        
        # Visualize
        self.visualize_groups()
        
        self.update_stats()
    
    def visualize_groups(self):
        """Draw group boundaries on image."""
        # Remove old graphics
        for item in self.group_graphics:
            try:
                self.scene.removeItem(item)
            except Exception as e:
                 QMessageBox.about(self, 'title', "removeItem error: " + str(e))
        QMessageBox.about(self, 'title', "cleared old group graphics")
        self.group_graphics.clear()
        self.view.groups_items.clear()
       
        if not self.groups:
            return
        
        strategy = self.combo_strategy.currentIndex()
        
        for group_indices in self.groups:
            group_list = list(group_indices)
            is_single = len(group_list) == 1
            
            # Determine shape based on strategy
            use_hull = False
            if strategy == 0:  # No grouping
                use_hull = True
            elif strategy == 1:  # BBox
                use_hull = False
            elif strategy == 2:  # BBox-Hull
                use_hull = is_single  # Hull for single objects
            elif strategy == 3:  # Hull-Hull
                use_hull = True
            
            frozen_group = frozenset(group_indices)
            is_selected = frozen_group in self.scene.selected_groups
            
            if use_hull and len(group_list) == 1:
                # Draw convex hull
                comp = self.extractor.components[group_list[0]]
                hull = comp['hull']
                
                points = [QPointF(float(p[0][0]), float(p[0][1])) for p in hull]
                polygon = QPolygonF(points)
                
                item = self.scene.addPolygon(
                    polygon,
                    pen=QPen(QColor(255, 255, 0) if is_selected else Qt.transparent, 2),
                    brush=QBrush(Qt.transparent)
                )
            else:
                # Draw bounding box
                x, y, w, h = self.extractor.get_group_bbox(group_list)
                
                item = self.scene.addRect(
                    x, y, w, h,
                    pen=QPen(QColor(255, 255, 0) if is_selected else Qt.transparent, 2),
                    brush=QBrush(Qt.transparent)
                )
            
            self.group_graphics.append(item)
            self.view.groups_items.append((frozen_group, item))
    
    def update_visualization(self):
        """Update visualization after selection change."""
        strategy = self.combo_strategy.currentIndex()
        
        for i, (frozen_group, item) in enumerate(self.view.groups_items):
            is_selected = frozen_group in self.scene.selected_groups
            
            # Update pen color
            if is_selected:
                pen = QPen(QColor(255, 255, 0), 2)
            else:
                pen = QPen(Qt.transparent, 2)
            
            if isinstance(item, QGraphicsRectItem):
                item.setPen(pen)
            elif isinstance(item, QGraphicsPolygonItem):
                item.setPen(pen)
        
        self.update_stats()
    
    def update_stats(self):
        """Update statistics label."""
        if not self.groups:
            self.label_stats.setText("Нет групп")
            return
        
        selected_count = len(self.scene.selected_groups)
        total_count = len(self.groups)
        
        self.label_stats.setText(
            f"Групп: {total_count}\n"
            f"Выделено: {selected_count}"
        )
    
    def extract_selected(self):
        """Extract selected groups to files."""
        if not self.scene.selected_groups:
            self.log("ВНИМАНИЕ: Не выбрано ни одной группы")
            return
        
        # Get list of selected groups
        selected_groups = [list(g) for g in self.scene.selected_groups]
        
        self.log(f"Извлечение {len(selected_groups)} групп...")
        
        # Find next available file number
        existing_files = list(self.extractor.output_dir.glob("object_*.png"))
        start_num = len(existing_files) + 1
        
        # Extract each selected group
        saved_count = 0
        for group_indices in selected_groups:
            x, y, w, h = self.extractor.get_group_bbox(group_indices)
            
            if w <= 0 or h <= 0:
                continue
            
            # Ensure bounds
            x = max(0, x)
            y = max(0, y)
            w = min(w, self.extractor.image.shape[1] - x)
            h = min(h, self.extractor.image.shape[0] - y)
            
            if w <= 0 or h <= 0:
                continue
            
            # Crop image
            cropped = self.extractor.image[y:y + h, x:x + w]
            
            # Create mask
            mask = self.extractor.get_group_mask(group_indices, (x, y, w, h))
            
            if cv2.countNonZero(mask) == 0:
                continue
            
            # Convert to RGBA
            rgba = cv2.cvtColor(cropped, cv2.COLOR_BGR2BGRA)
            rgba[:, :, 3] = mask
            
            # Save
            output_file = self.extractor.output_dir / f"object_{start_num + saved_count:03d}.png"
            if cv2.imwrite(str(output_file), rgba):
                self.log(f"  Сохранено: {output_file.name}")
                saved_count += 1
                
                # Remove from image (make transparent)
                self.extractor.image[y:y + h, x:x + w][mask > 0] = [255, 255, 255]
        
        self.log(f"Извлечено объектов: {saved_count}")
       
        # Remove extracted groups
        self.groups = [g for g in self.groups if frozenset(g) not in self.scene.selected_groups]
        self.scene.selected_groups.clear()
        QMessageBox.about(self, 'title', "display_image")
        # Redisplay image
        self.display_image()
        QMessageBox.about(self, 'title', "visualize_groups")
        self.visualize_groups()
        QMessageBox.about(self, 'title', "update_stats")
        self.update_stats()
        QMessageBox.about(self, 'title', "end")


def main():
    """Main entry point."""
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    print('window.show()')
    app.exec_()
    print('exit()')
    sys.exit()
    


if __name__ == "__main__":
    main()