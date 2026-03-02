import type { Bin } from '../api/client'

export interface PdfTranslations {
  cta: string
  unnamed: string
  pageOf: (current: number, total: number) => string
}

export async function generateQrPdf(
  bins: Bin[],
  baseUrl: string,
  translations: PdfTranslations,
): Promise<void> {
  const [{ jsPDF }, qrcode, { default: robotoRegularBase64 }, { default: robotoBoldBase64 }] =
    await Promise.all([
      import('jspdf'),
      import('qrcode-generator'),
      import('../assets/fonts/Roboto-Regular'),
      import('../assets/fonts/Roboto-Bold'),
    ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Register Roboto fonts for Unicode support (Czech/German diacritics)
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegularBase64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', robotoBoldBase64)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')

  const pageWidth = 210
  const pageHeight = 297

  for (let i = 0; i < bins.length; i++) {
    if (i > 0) doc.addPage()

    const bin = bins[i]
    const url = `${baseUrl}/report?bin=${bin.bin_id}`

    // CTA heading
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(46, 125, 50) // #2e7d32
    const ctaLines = doc.splitTextToSize(translations.cta, 170)
    doc.text(ctaLines, pageWidth / 2, 45, { align: 'center' })

    // Generate QR code matrix
    const qr = qrcode.default(0, 'L')
    qr.addData(url)
    qr.make()

    // Draw vector QR code (pure rectangles — infinite zoom)
    const moduleCount = qr.getModuleCount()
    const qrSizeMm = 150
    const moduleSizeMm = qrSizeMm / moduleCount
    const qrX = (pageWidth - qrSizeMm) / 2
    const qrY = 65

    doc.setFillColor(0, 0, 0)
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          doc.rect(
            qrX + col * moduleSizeMm,
            qrY + row * moduleSizeMm,
            moduleSizeMm,
            moduleSizeMm,
            'F',
          )
        }
      }
    }

    // Bin name
    const binName = bin.name || translations.unnamed
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(51, 51, 51) // #333
    doc.text(binName, pageWidth / 2, 225, { align: 'center' })

    // Bin type
    if (bin.bin_type) {
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(102, 102, 102) // #666
      doc.text(bin.bin_type, pageWidth / 2, 233, { align: 'center' })
    }

    // Address (may wrap)
    if (bin.address) {
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(136, 136, 136) // #888
      const addressLines = doc.splitTextToSize(bin.address, 160)
      doc.text(addressLines, pageWidth / 2, 241, { align: 'center' })
    }

    // Page number
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(5)
    doc.setTextColor(102, 102, 102) // #666
    doc.text(translations.pageOf(i + 1, bins.length), pageWidth - 10, pageHeight - 7, {
      align: 'right',
    })
  }

  const date = new Date().toISOString().slice(0, 10)
  doc.save(`ecoscan-qr-codes-${date}.pdf`)
}
