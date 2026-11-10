// Draws the app icon as a PDF; render to PNG with pdftoppm (see README).
import { writeFileSync } from 'node:fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
const doc = await PDFDocument.create()
const p = doc.addPage([512, 512])
p.drawRectangle({ x: 0, y: 0, width: 512, height: 512, color: rgb(0.106, 0.369, 0.125) })
const f = await doc.embedFont(StandardFonts.HelveticaBold)
const t = 'M'
p.drawText(t, { x: 256 - f.widthOfTextAtSize(t, 300) / 2, y: 150, size: 300, font: f, color: rgb(1, 1, 1) })
p.drawRectangle({ x: 96, y: 96, width: 320, height: 18, color: rgb(1, 1, 1) })
writeFileSync('out/icon.pdf', await doc.save())
