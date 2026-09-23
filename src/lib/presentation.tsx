import type { ComponentType, SVGProps } from 'react'
import ToothIcon from '../components/ToothIcon'
import {
  AlarmClock,
  Backpack,
  BookOpen,
  BriefcaseBusiness,
  Bug,
  Bus,
  Cat,
  CircleDot,
  ClipboardList,
  Code2,
  Dumbbell,
  GlassWater,
  GraduationCap,
  Heart,
  Home,
  Laptop,
  Moon,
  MoonStar,
  NotebookPen,
  PackageCheck,
  PawPrint,
  ShowerHead,
  Sparkles,
  Target,
  Utensils,
  WashingMachine
} from 'lucide-react'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

const icons: Record<string, IconType> = {
  alarm: AlarmClock,
  backpack: Backpack,
  book: BookOpen,
  briefcase: BriefcaseBusiness,
  bug: Bug,
  bus: Bus,
  cat: Cat,
  code: Code2,
  dishes: WashingMachine,
  dumbbell: Dumbbell,
  exercise: Dumbbell,
  fushi: ClipboardList,
  general: Target,
  home: Home,
  laptop: Laptop,
  meal: Utensils,
  moon: Moon,
  notebook: NotebookPen,
  package: PackageCheck,
  partner: Heart,
  paws: PawPrint,
  shower: ShowerHead,
  sleep: MoonStar,
  sparkle: Sparkles,
  study: GraduationCap,
  tasks: ClipboardList,
  tooth: ToothIcon,
  water: GlassWater
}

export function getIcon(name?: string): IconType {
  return (name && icons[name]) || CircleDot
}

export const categoryLabels: Record<string, string> = {
  hygiene: 'Higiene',
  pets: 'Pets',
  morning: 'Manhã',
  sleep: 'Sono',
  health: 'Saúde',
  home: 'Casa',
  relationship: 'Relacionamento',
  exercise: 'Academia',
  fitness: 'Academia',
  college: 'Estudos',
  fushi: 'Projetos',
  work: 'Trabalho',
  therapy: 'Terapia',
  personal: 'Pessoal',
  other: 'Outro'
}

export const categoryColors: Record<string, string> = {
  morning: 'green',
  sleep: 'purple',
  health: 'blue',
  home: 'yellow',
  relationship: 'red',
  exercise: 'blue',
  fitness: 'blue',
  college: 'cyan',
  fushi: 'purple',
  work: 'green',
  therapy: 'purple',
  personal: 'green',
  other: 'green'
}

export const habitStatusLabels: Record<string, string> = {
  active: 'Ativo',
  consolidated: 'Consolidado',
  trial: 'Em teste',
  future: 'Futuro',
  paused: 'Pausado'
}

export function toneForHabitStatus(status: string) {
  if (status === 'active') return 'success' as const
  if (status === 'consolidated') return 'info' as const
  if (status === 'trial') return 'warning' as const
  if (status === 'paused') return 'danger' as const
  return 'neutral' as const
}

export const moduleMeta = {
  pets: { title: "Pets", subtitle: "Cuidados, consultas e tarefas dos seus animais.", icon: PawPrint, color: "yellow" },
  work: {
    title: 'Trabalho',
    subtitle: 'Demandas, acompanhamentos e próximos passos profissionais.',
    icon: BriefcaseBusiness,
    color: 'green'
  },
  fushi: {
    title: 'Projetos',
    subtitle: 'Ideias, tarefas e próximos passos dos seus projetos.',
    icon: ClipboardList,
    color: 'purple'
  },
  college: {
    title: 'Estudos',
    subtitle: 'Cursos, trabalhos e prazos em um só lugar.',
    icon: GraduationCap,
    color: 'cyan'
  },
  home: {
    title: 'Casa',
    subtitle: 'Responsabilidades domésticas sem sobrecarregar o dia.',
    icon: Home,
    color: 'yellow'
  },
  fitness: {
    title: 'Academia',
    subtitle: 'Organize seus treinos e acompanhe o que foi realizado.',
    icon: Dumbbell,
    color: 'blue'
  },
  relationship: {
    title: 'Relacionamento',
    subtitle: 'Reserve tempo para as pessoas importantes para você.',
    icon: Heart,
    color: 'red'
  }
} as const

export const categoryIcons: Record<string, string> = {
  hygiene: 'tooth', pets: 'paws', morning: 'alarm', sleep: 'sleep', health: 'water', home: 'home',
  relationship: 'partner', exercise: 'dumbbell', fitness: 'dumbbell',
  college: 'study', fushi: 'fushi', work: 'briefcase', therapy: 'notebook',
  personal: 'general', other: 'general'
}
