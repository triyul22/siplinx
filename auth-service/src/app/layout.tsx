export const metadata = {
  title: "Siplinx AI — Account",
  description: "Авторизация и подписка Siplinx AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#FFE6A7",
          color: "#432818",
        }}
      >
        {children}
      </body>
    </html>
  );
}
