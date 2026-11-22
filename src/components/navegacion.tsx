import Link from "next/link";
import { usuarioActual } from "@/lib/sesion";
import { salir } from "@/app/acciones/auth";

export async function Navegacion() {
  const usuario = await usuarioActual();

  if (!usuario) {
    return (
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/ingresar" className="rounded-full px-4 py-2 font-semibold hover:bg-arena">
          Ingresar
        </Link>
        <Link href="/registro" className="boton !py-2">
          Crear cuenta
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-2 text-sm">
      <span className="hidden text-suave sm:inline">Hola, {usuario.nombre.split(" ")[0]}</span>
      <Link href="/panel" className="boton-linea !py-2">
        {usuario.rol === "profesional" ? "Mi agenda" : "Mis turnos"}
      </Link>
      <form action={salir}>
        <button className="rounded-full px-3 py-2 font-semibold text-suave hover:bg-arena">Salir</button>
      </form>
    </nav>
  );
}
