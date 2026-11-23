"""A scanned contract (all content invented): one page that is only an image, no text layer."""
from PIL import Image, ImageDraw
img = Image.new('RGB', (1240, 1754), 'white'); d = ImageDraw.Draw(img)
for i, line in enumerate(['Contract No. XY123/2031', 'ACT OF ENGAGEMENT', 'Name and address  DELTA UTILITIES LTD.', 'concluded until: 30/06/2031']):
    d.text((120, 160 + i * 60), line, fill='black')
img.save('tests/fixtures/scan.pdf', 'PDF', resolution=150)
