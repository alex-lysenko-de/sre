import qrcode
from PIL import Image

# Создаем QR-код с уровнем коррекции H (до 30% повреждений)
qr = qrcode.QRCode(
    version=3,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=10,
    border=4,
)
qr.add_data("https://alexanderlysenko.dev")  # Примерный URL
qr.make(fit=True)

img = qr.make_image(fill_color="black", back_color="white")
img.save("qr_original.png")
