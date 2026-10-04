/**
 * Content for the public demo workspace.
 *
 * The workspace holds no research data: visitors create their own, and the
 * nightly reset clears it. It is seeded with the CytoHub team as members, one
 * neutral sign-in account per role, and the configuration a lab starts from.
 * E-mail addresses use the reserved .example domain.
 */
import type { ColorToken } from '../../src/domain/schemas/common';

export const ORG = { name: 'CytoHub', slug: 'cytohub', timezone: 'America/New_York' };
export const DEMO_PASSWORD = 'cytolab-demo';

type Role = 'admin' | 'lab_manager' | 'scientist' | 'researcher' | 'viewer';

export interface PersonSeed {
  key: string;
  name: string;
  email: string;
  title: string;
  role: Role;
  color: ColorToken;
  teams: Array<{ team: string; lead?: boolean }>;
}

/**
 * The only accounts anyone can sign in to, one per role, with the published
 * demo password. Whatever visitors do is recorded under these names.
 */
export const DEMO_ACCOUNTS: PersonSeed[] = [
  { key: 'demo-admin', name: 'Demo Admin', email: 'demo-admin@cytohub.example', title: 'Demo account', role: 'admin', color: 'blue', teams: [] },
  { key: 'demo-lab-manager', name: 'Demo Lab Manager', email: 'demo-lab-manager@cytohub.example', title: 'Demo account', role: 'lab_manager', color: 'teal', teams: [{ team: 'analytical' }] },
  { key: 'demo-scientist', name: 'Demo Scientist', email: 'demo-scientist@cytohub.example', title: 'Demo account', role: 'scientist', color: 'violet', teams: [{ team: 'cell' }] },
  { key: 'demo-researcher', name: 'Demo Researcher', email: 'demo-researcher@cytohub.example', title: 'Demo account', role: 'researcher', color: 'orange', teams: [{ team: 'cell' }] },
  { key: 'demo-viewer', name: 'Demo Viewer', email: 'demo-viewer@cytohub.example', title: 'Demo account', role: 'viewer', color: 'slate', teams: [] },
];

/**
 * The CytoHub team, with names and titles as on cytohub.com. They appear as
 * members who can be given work, but their accounts cannot be signed in to,
 * so nothing a visitor posts appears under a real person's name.
 */
export const PEOPLE: PersonSeed[] = [
  { key: 'rajib', name: 'Rajib Biswas', email: 'rajib.biswas@cytohub.example', title: 'CEO & Founder', role: 'admin', color: 'blue', teams: [] },
  { key: 'richard', name: 'Richard J. Anderson', email: 'richard.anderson@cytohub.example', title: 'VP Technical Operations', role: 'lab_manager', color: 'teal', teams: [{ team: 'analytical' }] },
  { key: 'matthieu', name: 'Matthieu Bauer', email: 'matthieu.bauer@cytohub.example', title: 'Assoc. Director, Process Dev', role: 'scientist', color: 'violet', teams: [{ team: 'cell', lead: true }, { team: 'nad', lead: true }] },
  { key: 'soujanya', name: 'Nagasoujanya Annasamudram', email: 'nagasoujanya.annasamudram@cytohub.example', title: 'Team Lead, CytoHub.AI', role: 'scientist', color: 'indigo', teams: [{ team: 'analytical', lead: true }, { team: 'genome' }] },
  { key: 'satish', name: 'Satish Kumar', email: 'satish.kumar@cytohub.example', title: 'AI/ML Lead Engineer', role: 'scientist', color: 'green', teams: [{ team: 'genome', lead: true }] },
  { key: 'frank', name: 'Frank Teoh', email: 'frank.teoh@cytohub.example', title: 'VP Engineering · Co-founder', role: 'scientist', color: 'amber', teams: [{ team: 'tissue', lead: true }, { team: 'biomat', lead: true }] },
  { key: 'rista', name: 'Rista White', email: 'rista.white@cytohub.example', title: 'Research Associate I', role: 'researcher', color: 'orange', teams: [{ team: 'cell' }, { team: 'nad' }, { team: 'tissue' }, { team: 'biomat' }] },
  { key: 'anand', name: 'Anand Giddabasappa', email: 'anand.giddabasappa@cytohub.example', title: 'Advisor, Translational Pharmacology', role: 'viewer', color: 'slate', teams: [] },
];

export const TEAMS: Array<{ key: string; name: string; description: string; color: ColorToken }> = [
  { key: 'cell', name: 'Cell Therapy', description: 'CAR-T engineering, vector development and potency assays.', color: 'blue' },
  { key: 'nad', name: 'Nucleic Acid Delivery', description: 'mRNA and lipid nanoparticle formulation and delivery.', color: 'violet' },
  { key: 'tissue', name: 'Tissue Engineering', description: 'iPSC-derived tissues, organoids and engineered heart tissue.', color: 'pink' },
  { key: 'genome', name: 'Genome Engineering', description: 'Base editing, guide design and editing analytics.', color: 'teal' },
  { key: 'biomat', name: 'Biomaterials', description: 'Injectable hydrogels, scaffolds and controlled release.', color: 'amber' },
  { key: 'analytical', name: 'Analytical Sciences', description: 'Assay development, qualification and characterization.', color: 'indigo' },
];

export const RESEARCH_AREAS: Array<{ name: string; color: ColorToken }> = [
  { name: 'Cell Therapy', color: 'blue' },
  { name: 'Nucleic Acid Delivery', color: 'violet' },
  { name: 'Regenerative Medicine', color: 'pink' },
  { name: 'Genome Editing', color: 'teal' },
  { name: 'Biomaterials', color: 'amber' },
  { name: 'Analytical Development', color: 'indigo' },
];

export const EXPERIMENT_TYPES: Array<{ name: string; category: string; color: ColorToken; description: string }> = [
  { name: 'Lentiviral Transduction', category: 'Cell engineering', color: 'blue', description: 'Gene transfer into primary cells using lentiviral vectors.' },
  { name: 'Flow Cytometry', category: 'Cell-based assay', color: 'indigo', description: 'Multiparameter phenotyping and expression analysis.' },
  { name: 'Cytotoxicity Assay', category: 'Cell-based assay', color: 'red', description: 'Target-cell killing measured by impedance or luminescence.' },
  { name: 'Cytokine ELISA', category: 'Immunoassay', color: 'orange', description: 'Quantification of secreted cytokines or growth factors.' },
  { name: 'qPCR / ddPCR', category: 'Molecular biology', color: 'green', description: 'Nucleic acid quantification, copy number and expression.' },
  { name: 'LNP Formulation', category: 'Formulation', color: 'violet', description: 'Microfluidic lipid nanoparticle formulation.' },
  { name: 'Particle Characterization', category: 'Analytical', color: 'slate', description: 'Size, polydispersity, charge and encapsulation.' },
  { name: 'In Vitro Transfection', category: 'Cell-based assay', color: 'pink', description: 'Delivery and expression in cultured cells.' },
  { name: 'In Vivo Study', category: 'In vivo', color: 'amber', description: 'Whole-body distribution or expression of delivered payloads.' },
  { name: 'Genome Editing', category: 'Genome engineering', color: 'teal', description: 'Nuclease or base-editor delivery and editing.' },
  { name: 'NGS Amplicon Sequencing', category: 'Sequencing', color: 'green', description: 'Targeted sequencing of edited loci.' },
  { name: 'Cell Differentiation', category: 'Stem cell', color: 'pink', description: 'Directed differentiation of pluripotent stem cells.' },
  { name: 'Tissue Fabrication', category: 'Tissue engineering', color: 'red', description: 'Casting and culture of engineered tissue constructs.' },
  { name: 'Contractility Analysis', category: 'Functional assay', color: 'orange', description: 'Force, beat rate and calcium handling of cardiac tissue.' },
  { name: 'Histology & Imaging', category: 'Imaging', color: 'indigo', description: 'Sectioning, staining and microscopy.' },
  { name: 'Rheology', category: 'Materials testing', color: 'amber', description: 'Viscoelastic and gelation properties of materials.' },
  { name: 'Degradation & Release', category: 'Materials testing', color: 'slate', description: 'Degradation, swelling and payload release kinetics.' },
  { name: 'Cell Viability', category: 'Cell-based assay', color: 'green', description: 'Viability and proliferation readouts.' },
];

export const TAGS: Array<{ name: string; color: ColorToken }> = [
  { name: 'replicate', color: 'slate' },
  { name: 'pilot', color: 'violet' },
  { name: 'GLP-ready', color: 'green' },
  { name: 'reagent-lot-change', color: 'amber' },
  { name: 'method-development', color: 'blue' },
  { name: 'milestone-critical', color: 'red' },
  { name: 'dose-response', color: 'indigo' },
  { name: 'donor-variability', color: 'orange' },
  { name: 'tech-transfer', color: 'teal' },
  { name: 'follow-up', color: 'pink' },
];
