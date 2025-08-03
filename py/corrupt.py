import qrcode
from PIL import Image, ImageDraw

img = Image.open("qr_original.png")
draw = ImageDraw.Draw(img)

# Закрасим прямоугольник 40x40 пикселей (имитация грязи)
draw.rectangle((100, 100, 140, 140), fill="red")

img.save("qr_damaged.png")
