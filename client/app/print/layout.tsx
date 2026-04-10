/**
 * app/print/layout.tsx
 *
 * Bare shell — no nav, no sidebar, white background.
 * Puppeteer routes to this layout for PDF capture.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#ffffff', color: '#111' }}>
        {children}
      </body>
    </html>
  );
}
