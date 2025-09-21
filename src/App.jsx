import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Sparkles, Phone, Mail, MapPin, Instagram } from "lucide-react";

const palette = {
  coral: "#F77F6F",
  teal: "#4AB6B7",
  sand: "#FFF8F1",
  yellow: "#F9C74F",
  brown: "#8D6E63",
};

// ✅ Aquí subimos tu logo generado
// Lo puse en la carpeta /public/logo-festinhas.png
// Para usarlo en CodeSandbox: panel izquierdo → carpeta "public" → Upload → selecciona la imagen de tu logo.
// Si el archivo tiene otro nombre, cámbialo en src abajo.

const services = [
  {
    title: "Kits de Papelería para Fiestas",
    desc: "Invitaciones, toppers, banderines, stickers y más, 100% personalizados.",
    icon: "/icons/confetti.svg",
  },
  {
    title: "Diseño Personalizado",
    desc: "Creamos la identidad visual de tu evento con tu personaje o tema favorito.",
    icon: "/icons/magic.svg",
  },
  {
    title: "Impresión Premium",
    desc: "Papeles especiales, cortes precisos y acabados con amor (foil, lazos, relieves).",
    icon: "/icons/printer.svg",
  },
];

const gallery = [
  { src: "/galeria/kit1.jpg", alt: "Kit cumpleaños Conejito" },
  { src: "/galeria/kit2.jpg", alt: "Stickers personalizados" },
  { src: "/galeria/kit3.jpg", alt: "Banderines y toppers" },
];

const testimonials = [
  {
    name: "Carolina R.",
    text: "Quedó todo precioso y súper delicado. ¡Llegó a tiempo y mejor de lo que esperaba!",
  },
  {
    name: "Marcos D.",
    text: "El diseño fue exactamente como se lo pedimos. Atención 10/10 y calidad excelente.",
  },
  {
    name: "Daniela A.",
    text: "Mis invitados amaron cada detalle. ¡Se nota el cuidado y cariño en cada pieza!",
  },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FFF8F1] text-[#2b2b2b] font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur bg-[#FFF8F1]/80 border-b border-amber-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-festinhas.png" alt="Festinhas Criativa Papelaria" className="h-12 w-12 object-contain" onError={(e)=>{e.currentTarget.src='https://dummyimage.com/96x96/e5e5e5/333&text=Logo'}}/>
            <div>
              <p className="text-xl font-bold" style={{color: palette.coral}}>Festinhas</p>
              <p className="text-sm -mt-1" style={{color: palette.teal}}>Criativa Papelaria</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            {[
              ["Inicio", "hero"],
              ["Servicios", "servicios"],
              ["Galería", "galeria"],
              ["Testimonios", "testimonios"],
              ["Contacto", "contacto"],
            ].map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} className="hover:opacity-80 transition-opacity">
                {label}
              </button>
            ))}
            <a
              href="#contacto"
              onClick={(e)=>{e.preventDefault(); scrollTo('contacto');}}
              className="px-4 py-2 rounded-2xl shadow-sm"
              style={{ background: palette.coral, color: "white" }}
            >
              Pedir Presupuesto
            </a>
          </nav>

          <button className="md:hidden p-2 rounded-lg border" onClick={()=>setMenuOpen(v=>!v)}>
            <span className="sr-only">Abrir menú</span>☰
          </button>
        </div>
      </header>

      {/* Hero */}
      <section id="hero" className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{duration:.6}}>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4" style={{color: palette.brown}}>
              Papelería adorable para <span style={{color: palette.coral}}>festejar</span> momentos grandes.
            </h1>
            <p className="text-[17px] text-gray-700 mb-6">
              Diseñamos e imprimimos <b>kits personalizados</b> que combinan colores, tipografías y personajes para que tu celebración se vea única y muy tierna.
            </p>
            <div className="flex gap-3">
              <a href="#contacto" onClick={(e)=>{e.preventDefault(); scrollTo('contacto');}} className="px-5 py-3 rounded-2xl shadow-md font-medium" style={{background: palette.teal, color: 'white'}}>Quiero un diseño</a>
              <a href="#galeria" onClick={(e)=>{e.preventDefault(); scrollTo('galeria');}} className="px-5 py-3 rounded-2xl font-medium border" style={{borderColor: palette.coral, color: palette.coral}}>Ver ejemplos</a>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
              <Sparkles size={18} />
              <span>Hecho con amor en cada detalle</span>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, scale:.96}} animate={{opacity:1, scale:1}} transition={{duration:.6, delay:.1}} className="relative">
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full blur-3xl" style={{background: palette.yellow, opacity:.35}}/>
            <div className="absolute -bottom-10 -left-6 w-40 h-40 rounded-full blur-3xl" style={{background: palette.teal, opacity:.25}}/>
            <div className="relative bg-white/70 backdrop-blur rounded-3xl p-6 shadow-lg border">
              <img src="/logo-festinhas.png" alt="Logo preview" className="w-full max-w-sm mx-auto" onError={(e)=>{e.currentTarget.src='https://dummyimage.com/600x400/eaeaea/555&text=Sube+tu+logo'}}/>
              <p className="text-center text-sm mt-2 text-gray-500">Logo: Festinhas Criativa Papelaria</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
