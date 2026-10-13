import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Mail, Globe } from 'lucide-react';
import logoImg from '../assets/logo.png';

// Lucide-spec SVG Icons
function GithubIcon({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LinkedinIcon({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function InstagramIcon({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface Developer {
  name: string;
  role: string;
  department: string;
  bio: string;
  avatar: string;
  website?: string;
  github: string;
  linkedin: string;
  instagram: string;
  email: string;
  stack: string[];
}

const DEVELOPERS: Developer[] = [
  {
    name: 'Chundru Gowtham Krishna',
    role: 'System Architect, Full-Stack Engineer, Mobile App Developer & UI/UX Designer',
    department: 'Dept. of CSIT • SRKR Engineering College',
    bio: 'Architected the core system architecture, multi-tier permission state engine, PostgreSQL database schema, WebAuthn passkey authentication, and backend REST APIs.',
    avatar: 'https://github.com/gowthamkrishna27.png',
    website: 'https://gowthamkrishnachundru.vercel.app/',
    github: 'https://github.com/gowthamkrishna27',
    linkedin: 'https://www.linkedin.com/in/gowtham-krishna-chundru-213950324',
    instagram: 'https://instagram.com/gowthamchowdary.27',
    email: 'gowthamkrishna18v@gmail.com',
    stack: ['React 19', 'TypeScript', 'Node.js', 'PostgreSQL', 'Prisma', 'Express', 'WebAuthn', 'Kotlin', 'capacitor']
  },
  {
    name: 'Chandani Vivekananda',
    role: 'Full-Stack Developer & UI/UX Designer',
    department: 'Dept. of CSIT • SRKR Engineering College',
    bio: 'Built the multi-period attendance matrix (P1–P8), embedded student photo ExcelJS generator, WhatsApp export formatter, and responsive client-side workflows.',
    avatar: 'https://github.com/vivekanand77.png',
    website: 'https://gowthamkrishnachundru.vercel.app/',
    github: 'https://github.com/vivekanand77',
    linkedin: 'https://www.linkedin.com/in/vivekanandachandani',
    instagram: 'https://instagram.com/vivekkk_0_7_',
    email: 'chandanivivek770@gmail.com',
    stack: ['React 19', 'TypeScript', 'TailwindCSS', 'ExcelJS', 'Framer Motion', 'REST APIs']
  },
  {
    name: 'Pavan Ketha',
    role: 'Frontend Developer & UI Engineer',
    department: 'Dept. of CSIT • SRKR Engineering College',
    bio: 'Designed clean responsive user interfaces, streamlined student workflow components, and assisted in frontend state management and API integrations.',
    avatar: 'https://github.com/Pavanketha19.png',
    website: 'https://gowthamkrishnachundru.vercel.app/',
    github: 'https://github.com/Pavanketha19',
    linkedin: 'https://www.linkedin.com/in/pavan-ketha-5ab973383/',
    instagram: 'https://instagram.com/purnnaaaa_',
    email: 'pavanketha.palangi@gmail.com',
    stack: ['React 19', 'TypeScript', 'TailwindCSS', 'UI/UX Design', 'REST APIs']
  },
  {
    name: 'Kesanakurthi Manasa Satya',
    role: 'Frontend Developer & UI/UX Specialist',
    department: 'Dept. of CSIT • SRKR Engineering College',
    bio: 'Crafted accessible UI layouts, contributed to student modal views, form validations, and user experience enhancements across portals.',
    avatar: 'https://github.com/ManasaSatya26.png',
    website: 'https://gowthamkrishnachundru.vercel.app/',
    github: 'https://github.com/ManasaSatya26',
    linkedin: 'https://www.linkedin.com/in/manasa-satya-kesanakurthi-76a81937b/',
    instagram: 'https://instagram.com/satya_sidhi_263',
    email: 'kmanasasatya@gmail.com',
    stack: ['React 19', 'TypeScript', 'TailwindCSS', 'Framer Motion', 'UI/UX Design']
  }
];

const STACK_GROUPS = [
  {
    category: 'Frontend',
    items: ['React 19', 'TypeScript', 'Vite', 'TailwindCSS', 'Framer Motion', 'TanStack Query']
  },
  {
    category: 'Backend & Database',
    items: ['Node.js', 'Express.js', 'PostgreSQL', 'Prisma ORM', 'JWT Session Management']
  },
  {
    category: 'Integrations & Tools',
    items: ['WebAuthn Passkeys', 'ExcelJS Photo Embedder', 'WhatsApp Formatter', 'LLM AI API']
  }
];

export default function Developers() {
  const navigate = useNavigate();
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#09090B] font-sans antialiased selection:bg-black selection:text-white flex flex-col justify-between">
      {/* Navigation */}
      <nav className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src={logoImg} alt="AttendEase Logo" className="w-6 h-6 rounded-md object-contain" />
            <span className="font-bold text-sm tracking-tight text-zinc-900">AttendEase</span>
            <span className="text-zinc-300 text-xs">/</span>
            <span className="text-xs font-medium text-zinc-500">Developers</span>
          </Link>

          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="w-8 h-8 rounded-lg border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 flex items-center justify-center transition-colors shadow-sm"
          >
            <ArrowLeft size={16} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-14 flex-1 w-full">
        {/* Header */}
        <header className="mb-14 max-w-2xl">
          <p className="text-[11px] font-mono font-semibold tracking-widest text-zinc-400 uppercase mb-2">
            Engineering &amp; Design
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">
            Developers
          </h1>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
            The team behind AttendEase — built to streamline attendance and digital permission workflows for SRKR Engineering College.
          </p>
          <div className="mt-4">
            <Link
              to="/recruitment"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200/80 text-orange-700 hover:bg-orange-100 text-xs font-semibold transition-colors"
            >
              <span>🚀 AttendEase is recruiting new team members! Apply here</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </header>

        {/* Developer Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {DEVELOPERS.map((dev) => (
            <div
              key={dev.name}
              className="bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-zinc-300 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
            >
              <div>
                {/* Header: Avatar + Info */}
                <div className="flex items-start gap-4 pb-5 border-b border-zinc-100">
                  <img
                    src={dev.avatar}
                    alt={dev.name}
                    className="w-14 h-14 rounded-xl object-cover border border-zinc-200 bg-zinc-100 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(dev.name)}&backgroundColor=18181b&textColor=fafafa`;
                    }}
                  />
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight truncate">
                      {dev.name}
                    </h2>
                    <p className="text-xs font-medium text-zinc-700 mt-0.5">
                      {dev.role}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {dev.department}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                <p className="text-xs text-zinc-600 leading-relaxed mt-4">
                  {dev.bio}
                </p>

                {/* Tags */}
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {dev.stack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-zinc-100 text-zinc-600"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Links with Individual Social Icons */}
              <div className="mt-7 pt-4 border-t border-zinc-100 flex items-center justify-between gap-3 text-xs">
                {/* Social Icons Group */}
                <div className="flex items-center gap-1.5">
                  <a
                    href={dev.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg border border-zinc-200 hover:border-zinc-400 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 flex items-center justify-center transition-all"
                    title="GitHub"
                  >
                    <GithubIcon size={15} />
                  </a>

                  <a
                    href={dev.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg border border-zinc-200 hover:border-zinc-400 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 flex items-center justify-center transition-all"
                    title="LinkedIn"
                  >
                    <LinkedinIcon size={15} />
                  </a>

                  <a
                    href={dev.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg border border-zinc-200 hover:border-zinc-400 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 flex items-center justify-center transition-all"
                    title="Instagram"
                  >
                    <InstagramIcon size={15} />
                  </a>

                  {dev.website && (
                    <a
                      href={dev.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg border border-orange-200 hover:border-orange-400 bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700 flex items-center justify-center transition-all"
                      title="Portfolio Website"
                    >
                      <Globe size={15} />
                    </a>
                  )}
                </div>

                {/* Email Copy Button */}
                <button
                  onClick={() => copyEmail(dev.email)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition-all cursor-pointer"
                  title={`Copy ${dev.email}`}
                >
                  {copiedEmail === dev.email ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                      <Check size={12} /> Copied
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                      <Mail size={12} className="text-zinc-400" />
                      <span>{dev.email.split('@')[0]}</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Minimal Stack Section */}
        <section className="border-t border-zinc-200 pt-10 mb-14">
          <h3 className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-6">
            Technology Stack
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STACK_GROUPS.map((group) => (
              <div key={group.category} className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-800">{group.category}</h4>
                <ul className="space-y-1 text-xs text-zinc-500 font-mono">
                  {group.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Minimal Open Source Section */}
        <section className="bg-white border border-zinc-200/90 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Open Source Repository</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Explore the code, report issues, or contribute on GitHub.
            </p>
          </div>
          <a
            href="https://github.com/gowthamkrishna27/AttendEase"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            <span>AttendEase Repository</span>
            <ArrowUpRight size={13} />
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/80 bg-white py-6">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-800">AttendEase</span>
            <span>•</span>
            <span>SRKR Engineering College</span>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-zinc-900 transition-colors">Home</Link>
            <Link to="/permissions" className="hover:text-zinc-900 transition-colors">Permissions</Link>
            <Link to="/login" className="hover:text-zinc-900 transition-colors">Login</Link>
            <a
              href="https://github.com/gowthamkrishna27/AttendEase"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
