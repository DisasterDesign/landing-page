export interface NavItem {
  label: string;
  href: string;
}

export interface TeamMember {
  name: string;
  nameHe: string;
  role: string;
  roleHe: string;
  email: string;
  bio: string;
  image: string;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  tagline: string;
  sections: { title: string; items: string[] }[];
  suitableFor: string;
  recommended?: boolean;
  cta: string;
}

export interface PortfolioProject {
  id: string;
  slug: string;
  title: string;
  client: string;
  description: string;
  image: string;
  category: string;
}

export interface ProcessStep {
  number: string;
  title: string;
  description: string;
}

export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
  service?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}
