import './style.css';
export const metadata = {
  title: 'Chá de Fraldas da Laura',
  description: 'Um carinho em cada pacotinho. Escolha seu presente para a Laura e gerencie sua reserva pelo link privado.',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
