/**
 * Content for the synthetic demo workspace.
 *
 * Everything here is fictional: the organization, people, e-mail addresses
 * (reserved .example domain), lots and donors. Measured values are generated
 * from plausible ranges purely to exercise the product and must never be read
 * as scientific findings.
 */
import type { InputType, Priority, ProjectStatus } from '../../src/domain/enums';
import type { ColorToken } from '../../src/domain/schemas/common';

export const ORG = { name: 'Acme Biosciences', slug: 'acme-bio', timezone: 'America/New_York' };
export const DEMO_PASSWORD = 'cytolab-demo';

export interface PersonSeed {
  key: string;
  name: string;
  email: string;
  title: string;
  role: 'admin' | 'lab_manager' | 'scientist' | 'researcher' | 'viewer';
  color: ColorToken;
  teams: Array<{ team: string; lead?: boolean }>;
}

export const PEOPLE: PersonSeed[] = [
  { key: 'sarah', name: 'Dr. Sarah Chen', email: 'sarah.chen@acme-bio.example', title: 'Director of Research', role: 'admin', color: 'blue', teams: [{ team: 'cell', lead: true }] },
  { key: 'john', name: 'John Smith', email: 'john.smith@acme-bio.example', title: 'Lab Operations Manager', role: 'lab_manager', color: 'teal', teams: [{ team: 'analytical' }] },
  { key: 'priya', name: 'Dr. Priya Raman', email: 'priya.raman@acme-bio.example', title: 'Principal Scientist', role: 'scientist', color: 'violet', teams: [{ team: 'nad', lead: true }] },
  { key: 'marcus', name: 'Dr. Marcus Okafor', email: 'marcus.okafor@acme-bio.example', title: 'Senior Scientist', role: 'scientist', color: 'pink', teams: [{ team: 'tissue', lead: true }] },
  { key: 'elena', name: 'Dr. Elena Vasquez', email: 'elena.vasquez@acme-bio.example', title: 'Principal Scientist', role: 'scientist', color: 'green', teams: [{ team: 'genome', lead: true }] },
  { key: 'kenji', name: 'Dr. Kenji Watanabe', email: 'kenji.watanabe@acme-bio.example', title: 'Senior Scientist', role: 'scientist', color: 'amber', teams: [{ team: 'biomat', lead: true }] },
  { key: 'grace', name: 'Dr. Grace Adeyemi', email: 'grace.adeyemi@acme-bio.example', title: 'Scientist, Analytical Sciences', role: 'scientist', color: 'indigo', teams: [{ team: 'analytical', lead: true }] },
  { key: 'aisha', name: 'Aisha Rahman', email: 'aisha.rahman@acme-bio.example', title: 'Research Associate II', role: 'researcher', color: 'orange', teams: [{ team: 'cell' }] },
  { key: 'lucas', name: 'Lucas Meyer', email: 'lucas.meyer@acme-bio.example', title: 'Research Associate', role: 'researcher', color: 'slate', teams: [{ team: 'cell' }] },
  { key: 'hannah', name: 'Hannah Kim', email: 'hannah.kim@acme-bio.example', title: 'Senior Research Associate', role: 'researcher', color: 'red', teams: [{ team: 'nad' }] },
  { key: 'diego', name: 'Diego Alvarez', email: 'diego.alvarez@acme-bio.example', title: 'Research Associate', role: 'researcher', color: 'blue', teams: [{ team: 'nad' }] },
  { key: 'olivia', name: 'Olivia Brooks', email: 'olivia.brooks@acme-bio.example', title: 'Research Scientist', role: 'researcher', color: 'violet', teams: [{ team: 'tissue' }] },
  { key: 'samuel', name: 'Samuel Osei', email: 'samuel.osei@acme-bio.example', title: 'Research Associate', role: 'researcher', color: 'teal', teams: [{ team: 'genome' }] },
  { key: 'mei', name: 'Mei Lin', email: 'mei.lin@acme-bio.example', title: 'Senior Research Associate', role: 'researcher', color: 'pink', teams: [{ team: 'genome' }] },
  { key: 'noah', name: 'Noah Fischer', email: 'noah.fischer@acme-bio.example', title: 'Research Associate', role: 'researcher', color: 'green', teams: [{ team: 'biomat' }] },
  { key: 'tom', name: 'Tom Becker', email: 'tom.becker@acme-bio.example', title: 'VP, Program Management', role: 'viewer', color: 'slate', teams: [] },
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

/** A measured quantity. Values are drawn from `range` (or picked from `text`) at seed time. */
export interface MetricSpec {
  name: string;
  unit?: string;
  range?: [number, number];
  digits?: number;
  key?: boolean;
}

/** A kind of experiment run in a project. The generator expands it into instances. */
export interface Blueprint {
  title: string;
  type: string;
  objective: string;
  hypothesis: string;
  protocolRef?: string;
  conditions: Array<[string, string, string?]>;
  inputs: Array<{ name: string; type: InputType; identifier?: string; quantity?: number; unit?: string }>;
  steps: string[];
  metrics: MetricSpec[];
  /** Produced sample name + type, when the run yields material. */
  output?: { name: string; type: string; unit?: string };
  summary: string;
  conclusion: string;
}

export interface MilestoneSeed {
  title: string;
  description?: string;
  dueOffset: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completedOffset?: number;
}

export interface ProjectSeed {
  code: string;
  name: string;
  description: string;
  area: string;
  team: string;
  owner: string;
  status: ProjectStatus;
  priority: Priority;
  startOffset: number;
  targetOffset: number;
  completedOffset?: number;
  notes?: string;
  milestones: MilestoneSeed[];
  experimentCount: number;
  /** Experiment start dates fall between these day offsets relative to today. */
  window: [number, number];
  blueprints: Blueprint[];
  tags: string[];
}

const TC_MEDIA = { name: 'T cell expansion medium', type: 'media' as const, identifier: 'MED-TC-02', quantity: 500, unit: 'mL' };
const DONOR_PBMC = { name: 'Donor PBMCs (synthetic donor D-017)', type: 'cell_line' as const, identifier: 'D-017', quantity: 50, unit: 'M cells' };

export const PROJECTS: ProjectSeed[] = [
  {
    code: 'CART-001',
    name: 'CAR-T Cell Engineering',
    description:
      'Engineer and characterize next-generation CD19-directed CAR-T constructs with improved persistence. Workstreams cover lentiviral vector optimization, functional potency, exhaustion profiling and manufacturability.',
    area: 'Cell Therapy',
    team: 'cell',
    owner: 'sarah',
    status: 'active',
    priority: 'high',
    startOffset: -165,
    targetOffset: 120,
    notes: 'Program review every other Thursday. Potency readouts gate the persistence study (M4). Keep donor identifiers de-identified in all records.',
    milestones: [
      { title: 'Lead CAR construct design locked', dueOffset: -120, status: 'completed', completedOffset: -124 },
      { title: 'Transduction process optimized', description: 'Target CAR+ ≥ 40% at VCN < 5.', dueOffset: -60, status: 'completed', completedOffset: -55 },
      { title: 'In vitro potency established', description: 'Cytotoxicity and cytokine release across three donors.', dueOffset: 9, status: 'in_progress' },
      { title: 'Persistence study readout', dueOffset: 60, status: 'pending' },
      { title: 'Tech-transfer package to process development', dueOffset: 115, status: 'pending' },
    ],
    experimentCount: 30,
    window: [-160, 28],
    tags: ['replicate', 'donor-variability', 'milestone-critical', 'dose-response', 'follow-up', 'reagent-lot-change'],
    blueprints: [
      {
        title: 'Lentiviral transduction — MOI titration',
        type: 'Lentiviral Transduction',
        objective: 'Determine the MOI that maximizes CAR expression while keeping vector copy number below 5 copies per cell.',
        hypothesis: 'CAR+ frequency plateaus above MOI 5 while VCN keeps rising.',
        protocolRef: 'SOP-CT-014 v3',
        conditions: [['MOI', '1, 2.5, 5, 10'], ['Activation', 'CD3/CD28 beads, day 0'], ['Seeding density', '1.0', '×10⁶ cells/mL']],
        inputs: [DONOR_PBMC, TC_MEDIA, { name: 'CD19-CAR lentiviral vector', type: 'reagent', identifier: 'LV-0421', quantity: 2, unit: 'mL' }],
        steps: ['Thaw PBMCs and rest overnight', 'Activate with CD3/CD28 beads', 'Transduce 24 h post-activation', 'Expand for 7 days', 'Stain and acquire on cytometer'],
        metrics: [
          { name: 'CAR+ T cells at MOI 5', unit: '%', range: [38, 58], key: true },
          { name: 'Vector copy number at MOI 5', unit: 'copies/cell', range: [1.8, 4.2], digits: 2 },
          { name: 'Fold expansion (day 7)', unit: 'fold', range: [18, 45], digits: 0 },
        ],
        output: { name: 'Transduced T cells', type: 'Engineered T cells', unit: 'M cells' },
        summary: 'CAR+ frequency rose from MOI 1 to 5 and plateaued at MOI 10 while VCN kept rising (synthetic demo values).',
        conclusion: 'MOI 5 selected as the working condition for the potency workstream.',
      },
      {
        title: 'CAR expression kinetics',
        type: 'Flow Cytometry',
        objective: 'Track CAR surface expression and CD4:CD8 composition through expansion.',
        hypothesis: 'CAR expression stabilizes by day 7 without skewing the CD4:CD8 ratio.',
        protocolRef: 'SOP-FC-003 v5',
        conditions: [['Timepoints', 'Day 3, 7, 10, 14'], ['Events acquired', '50,000', 'events']],
        inputs: [{ name: 'CAR detection reagent (anti-idiotype)', type: 'antibody', identifier: 'AB-CAR-12' }, { name: 'Fixable viability dye', type: 'reagent', identifier: 'LOT-VD-551' }],
        steps: ['Harvest cells at each timepoint', 'Stain surface panel', 'Acquire on cytometer', 'Gate and export statistics'],
        metrics: [
          { name: 'CAR+ T cells (day 10)', unit: '%', range: [40, 62], key: true },
          { name: 'CD4:CD8 ratio (day 10)', unit: 'ratio', range: [0.8, 1.9], digits: 2 },
        ],
        summary: 'Expression stabilized after day 7 with an in-range CD4:CD8 ratio (synthetic demo values).',
        conclusion: 'Day-10 harvest retained for downstream functional assays.',
      },
      {
        title: 'Cytotoxicity vs CD19+ targets — E:T titration',
        type: 'Cytotoxicity Assay',
        objective: 'Quantify specific lysis of CD19+ target cells across effector-to-target ratios.',
        hypothesis: 'Specific lysis exceeds 60% at 10:1 E:T within 24 hours.',
        protocolRef: 'SOP-CT-022 v2',
        conditions: [['E:T ratios', '1:1, 3:1, 10:1'], ['Co-culture', '24', 'h']],
        inputs: [{ name: 'CD19+ luciferase reporter target cells', type: 'cell_line', identifier: 'TGT-CD19-LUC' }, { name: 'Luciferase substrate', type: 'reagent', identifier: 'LOT-LUC-778' }],
        steps: ['Plate target cells', 'Add effectors at E:T ratios', 'Co-culture 24 h', 'Read luminescence', 'Calculate specific lysis'],
        metrics: [
          { name: 'Specific lysis at 10:1 E:T', unit: '%', range: [55, 88], key: true },
          { name: 'Untransduced control lysis', unit: '%', range: [2, 9] },
        ],
        summary: 'Dose-dependent killing with low background from untransduced controls (synthetic demo values).',
        conclusion: 'Construct meets the in vitro cytotoxicity criterion for milestone M3.',
      },
      {
        title: 'Cytokine release — IFN-γ and IL-2',
        type: 'Cytokine ELISA',
        objective: 'Measure antigen-dependent IFN-γ and IL-2 secretion after 24 h co-culture.',
        hypothesis: 'IFN-γ release is at least 10-fold higher with antigen-positive targets.',
        protocolRef: 'SOP-AN-031 v1',
        conditions: [['Co-culture', '24', 'h'], ['Replicates', '3']],
        inputs: [{ name: 'IFN-γ ELISA kit', type: 'reagent', identifier: 'LOT-EL-IFNG-22' }, { name: 'IL-2 ELISA kit', type: 'reagent', identifier: 'LOT-EL-IL2-09' }],
        steps: ['Collect supernatants', 'Run ELISA plates', 'Read absorbance', 'Fit standard curve'],
        metrics: [
          { name: 'IFN-γ release (antigen+)', unit: 'pg/mL', range: [1800, 5200], digits: 0, key: true },
          { name: 'IFN-γ release (antigen−)', unit: 'pg/mL', range: [40, 180], digits: 0 },
        ],
        summary: 'Antigen-specific cytokine secretion with low background (synthetic demo values).',
        conclusion: 'Cytokine profile consistent with antigen-dependent activation.',
      },
      {
        title: 'Vector copy number by ddPCR',
        type: 'qPCR / ddPCR',
        objective: 'Quantify integrated vector copies per transduced cell.',
        hypothesis: 'Mean VCN stays below 5 copies per cell at the working MOI.',
        protocolRef: 'SOP-MB-011 v4',
        conditions: [['Reference gene', 'RPP30'], ['Input gDNA', '50', 'ng']],
        inputs: [{ name: 'ddPCR supermix', type: 'reagent', identifier: 'LOT-DD-3321' }, { name: 'WPRE / RPP30 primer-probe sets', type: 'reagent', identifier: 'PP-WPRE-02' }],
        steps: ['Extract gDNA', 'Set up ddPCR reactions', 'Generate droplets and cycle', 'Compute VCN'],
        metrics: [{ name: 'Mean vector copy number', unit: 'copies/cell', range: [1.6, 4.4], digits: 2, key: true }],
        output: { name: 'gDNA extract', type: 'Genomic DNA', unit: 'µL' },
        summary: 'VCN within the acceptance range across conditions (synthetic demo values).',
        conclusion: 'VCN assay performance adequate for routine use.',
      },
      {
        title: 'Post-thaw recovery of cryopreserved product',
        type: 'Cell Viability',
        objective: 'Assess recovery and viability after cryopreservation in two formulations.',
        hypothesis: 'Formulation B yields ≥ 85% post-thaw viability.',
        protocolRef: 'SOP-CT-030 v1',
        conditions: [['Formulations', 'A (5% DMSO), B (7.5% DMSO)'], ['Storage', '14 days, vapor-phase LN₂']],
        inputs: [{ name: 'Cryopreservation medium', type: 'media', identifier: 'LOT-CRYO-118' }],
        steps: ['Formulate and freeze at controlled rate', 'Store 14 days', 'Thaw and count', 'Assess viability and recovery'],
        metrics: [{ name: 'Post-thaw viability (B)', unit: '%', range: [82, 94], key: true }],
        summary: 'Formulation B met the viability target (synthetic demo values).',
        conclusion: 'Formulation B adopted for persistence study material.',
      },
    ],
  },
  {
    code: 'MRNA-LNP',
    name: 'mRNA Delivery Platform',
    description:
      'Develop a lipid nanoparticle platform for hepatic mRNA delivery: ionizable lipid screening, formulation optimization, characterization and early in vivo expression.',
    area: 'Nucleic Acid Delivery',
    team: 'nad',
    owner: 'priya',
    status: 'active',
    priority: 'critical',
    startOffset: -210,
    targetOffset: 55,
    notes: 'Lead lipid IL-07 selected in M2. Stability program must complete before the scale-up decision.',
    milestones: [
      { title: 'Ionizable lipid library screened', dueOffset: -150, status: 'completed', completedOffset: -146 },
      { title: 'Lead formulation selected', dueOffset: -75, status: 'completed', completedOffset: -80 },
      { title: 'In vivo expression confirmed', description: 'Hepatic expression at ≥ 3 dose levels.', dueOffset: -6, status: 'in_progress' },
      { title: 'Stability program complete', dueOffset: 45, status: 'pending' },
    ],
    experimentCount: 28,
    window: [-205, 25],
    tags: ['dose-response', 'pilot', 'reagent-lot-change', 'milestone-critical', 'method-development', 'replicate'],
    blueprints: [
      {
        title: 'Ionizable lipid library screen',
        type: 'LNP Formulation',
        objective: 'Rank ionizable lipids by encapsulation, particle size and in vitro expression.',
        hypothesis: 'Lipids with branched tails give higher expression at equivalent size.',
        protocolRef: 'SOP-FM-002 v6',
        conditions: [['N/P ratio', '6'], ['Molar ratio', '50:10:38.5:1.5', 'IL:DSPC:Chol:PEG'], ['Total flow rate', '12', 'mL/min']],
        inputs: [{ name: 'Ionizable lipid library', type: 'compound', identifier: 'LIB-IL-24' }, { name: 'Reporter mRNA', type: 'reagent', identifier: 'MRNA-FLUC-08', quantity: 2, unit: 'mg' }],
        steps: ['Prepare lipid stocks in ethanol', 'Formulate on microfluidic mixer', 'Dialyze against PBS', 'Measure size and encapsulation', 'Transfect and read expression'],
        metrics: [
          { name: 'Encapsulation efficiency (lead)', unit: '%', range: [86, 97], key: true },
          { name: 'Z-average diameter (lead)', unit: 'nm', range: [72, 98], digits: 0 },
          { name: 'Polydispersity index (lead)', unit: 'PDI', range: [0.06, 0.16], digits: 2 },
        ],
        output: { name: 'LNP formulation', type: 'LNP formulation', unit: 'mL' },
        summary: 'Branched-tail lipids ranked highest for expression at comparable size (synthetic demo values).',
        conclusion: 'Top four lipids advanced to N/P optimization.',
      },
      {
        title: 'N/P ratio optimization',
        type: 'LNP Formulation',
        objective: 'Identify the N/P ratio balancing encapsulation and tolerability for the lead lipid.',
        hypothesis: 'N/P 6 gives ≥ 90% encapsulation with lower toxicity than N/P 10.',
        protocolRef: 'SOP-FM-002 v6',
        conditions: [['N/P ratios', '3, 6, 10'], ['Buffer', 'Citrate pH 4.0 → PBS']],
        inputs: [{ name: 'Lead ionizable lipid IL-07', type: 'compound', identifier: 'LOT-IL07-004' }, { name: 'Reporter mRNA', type: 'reagent', identifier: 'MRNA-FLUC-08' }],
        steps: ['Formulate at three N/P ratios', 'Buffer exchange', 'Characterize particles', 'Assess expression and viability'],
        metrics: [{ name: 'Encapsulation at N/P 6', unit: '%', range: [88, 96], key: true }],
        summary: 'N/P 6 matched N/P 10 expression with improved viability (synthetic demo values).',
        conclusion: 'N/P 6 fixed for the lead formulation.',
      },
      {
        title: 'Particle size and charge characterization',
        type: 'Particle Characterization',
        objective: 'Characterize size distribution and surface charge of candidate formulations.',
        hypothesis: 'All candidates are below 100 nm with PDI < 0.2.',
        protocolRef: 'SOP-AN-008 v3',
        conditions: [['Temperature', '25', '°C'], ['Measurements', '3 × 12 runs']],
        inputs: [{ name: 'Disposable cuvettes', type: 'consumable' }, { name: 'Folded capillary cells', type: 'consumable' }],
        steps: ['Equilibrate instrument', 'Measure size in triplicate', 'Measure zeta potential', 'Export distributions'],
        metrics: [
          { name: 'Z-average diameter', unit: 'nm', range: [70, 105], digits: 0, key: true },
          { name: 'PDI', unit: 'PDI', range: [0.05, 0.21], digits: 2 },
        ],
        summary: 'Candidates within size specification; one lot above the PDI limit (synthetic demo values).',
        conclusion: 'Proceed with lots meeting PDI < 0.2.',
      },
      {
        title: 'Hepatocyte transfection dose response',
        type: 'In Vitro Transfection',
        objective: 'Determine the EC50 of reporter expression for the lead formulation.',
        hypothesis: 'EC50 is below 50 ng mRNA per well.',
        protocolRef: 'SOP-CB-015 v2',
        conditions: [['Doses', '6-point, 3-fold dilution'], ['Incubation', '24', 'h']],
        inputs: [{ name: 'Hepatocyte reporter line', type: 'cell_line', identifier: 'CL-HEP-P12' }, { name: 'Luciferase assay reagent', type: 'reagent', identifier: 'LOT-LUC-778' }],
        steps: ['Seed cells', 'Dose LNP series', 'Incubate 24 h', 'Read luminescence', 'Fit 4PL curve'],
        metrics: [{ name: 'EC50', unit: 'ng/well', range: [18, 60], digits: 1, key: true }],
        summary: 'Sigmoidal dose response with a sub-50 ng EC50 (synthetic demo values).',
        conclusion: 'Formulation potency acceptable for in vivo dosing.',
      },
      {
        title: 'In vivo expression pilot',
        type: 'In Vivo Study',
        objective: 'Confirm liver-targeted expression 6 h after dosing at three dose levels.',
        hypothesis: 'Liver accounts for > 85% of total reporter signal at all dose levels.',
        protocolRef: 'IVP-011 v2 (approved animal protocol)',
        conditions: [['Dose levels', '0.1, 0.3, 1.0', 'mg/kg'], ['Group size', 'n = 5']],
        inputs: [{ name: 'Lead LNP formulation', type: 'reagent', identifier: 'LNP-IL07-L3' }, { name: 'Imaging substrate', type: 'reagent', identifier: 'LOT-DLUC-221' }],
        steps: ['Dose animals', 'Image at 6 h', 'Harvest organs for ex vivo imaging', 'Quantify regional signal'],
        metrics: [{ name: 'Liver share of total signal (high dose)', unit: '%', range: [84, 96], key: true }],
        summary: 'Dose-proportional, liver-dominant expression (synthetic demo values).',
        conclusion: 'Supports milestone M3; confirm at the low dose in a replicate study.',
      },
      {
        title: 'Accelerated stability study',
        type: 'Particle Characterization',
        objective: 'Evaluate particle size, encapsulation and potency drift over four weeks.',
        hypothesis: 'At 4 °C, size changes < 10% and encapsulation stays > 85% at week 4.',
        protocolRef: 'SOP-ST-001 v1',
        conditions: [['Storage', '4 °C and 25 °C'], ['Timepoints', 'Week 0, 1, 2, 4']],
        inputs: [{ name: 'Lead LNP lot', type: 'reagent', identifier: 'LNP-IL07-L4' }],
        steps: ['Aliquot onto stability', 'Pull timepoints', 'Measure size and encapsulation', 'Run potency assay'],
        metrics: [
          { name: 'Size change at week 4 (4 °C)', unit: '%', range: [2, 9], key: true },
          { name: 'Encapsulation at week 4 (4 °C)', unit: '%', range: [85, 93] },
        ],
        summary: 'Refrigerated samples stable through week 4; 25 °C samples aggregated (synthetic demo values).',
        conclusion: 'Cold-chain storage required; lyophilization study proposed.',
      },
    ],
  },
  {
    code: 'CARD-TE',
    name: 'Cardiac Tissue Engineering',
    description:
      'Build engineered heart tissue from iPSC-derived cardiomyocytes with physiologically relevant force generation for disease modeling and cardiotoxicity screening.',
    area: 'Regenerative Medicine',
    team: 'tissue',
    owner: 'marcus',
    status: 'active',
    priority: 'medium',
    startOffset: -125,
    targetOffset: 205,
    milestones: [
      { title: 'Robust iPSC-CM differentiation protocol', dueOffset: -70, status: 'completed', completedOffset: -66 },
      { title: 'Engineered heart tissue constructs established', dueOffset: 21, status: 'in_progress' },
      { title: 'Contractility benchmarking vs. reference', dueOffset: 95, status: 'pending' },
      { title: 'Maturation strategy selected', dueOffset: 185, status: 'pending' },
    ],
    experimentCount: 20,
    window: [-120, 30],
    tags: ['method-development', 'replicate', 'pilot', 'follow-up'],
    blueprints: [
      {
        title: 'iPSC-CM differentiation — Wnt timing',
        type: 'Cell Differentiation',
        objective: 'Optimize the timing of Wnt activation and inhibition to maximize cardiomyocyte purity.',
        hypothesis: 'Inhibition on day 3 rather than day 2 increases cTnT+ purity above 85%.',
        protocolRef: 'SOP-SC-006 v2',
        conditions: [['CHIR99021', '6', 'µM'], ['Wnt inhibition day', 'Day 2 vs Day 3']],
        inputs: [{ name: 'Human iPSC line (synthetic line iPS-A2)', type: 'cell_line', identifier: 'IPS-A2-P28' }, { name: 'CHIR99021', type: 'compound', identifier: 'LOT-CHIR-310' }],
        steps: ['Seed iPSCs on coated plates', 'Wnt activation (day 0)', 'Wnt inhibition (day 2 or 3)', 'Metabolic selection', 'Flow cytometry for cTnT'],
        metrics: [
          { name: 'cTnT+ cells (day 15)', unit: '%', range: [72, 93], key: true },
          { name: 'Beating onset', unit: 'day', range: [7, 10], digits: 0 },
        ],
        output: { name: 'iPSC-derived cardiomyocytes', type: 'iPSC-derived cells', unit: 'M cells' },
        summary: 'Day-3 inhibition improved purity in two of three differentiations (synthetic demo values).',
        conclusion: 'Adopt day-3 inhibition; repeat to confirm robustness.',
      },
      {
        title: 'Engineered heart tissue casting',
        type: 'Tissue Fabrication',
        objective: 'Establish casting conditions that yield compacted, beating tissues by day 7.',
        hypothesis: 'A 70:30 cardiomyocyte:fibroblast ratio improves compaction versus 90:10.',
        protocolRef: 'SOP-TE-002 v1',
        conditions: [['Cell ratio', '70:30 vs 90:10', 'CM:FB'], ['Cells per tissue', '1.0', '×10⁶']],
        inputs: [{ name: 'iPSC-CMs (day 15)', type: 'cell_line' }, { name: 'Cardiac fibroblasts (synthetic lot)', type: 'cell_line', identifier: 'HCF-SYN-07' }, { name: 'Fibrinogen', type: 'reagent', identifier: 'LOT-FBG-091' }],
        steps: ['Prepare cell–hydrogel mix', 'Cast into post molds', 'Culture with daily media change', 'Assess compaction and beating'],
        metrics: [{ name: 'Tissues beating by day 7', unit: '%', range: [60, 95], key: true }],
        output: { name: 'Engineered heart tissue', type: 'Tissue construct', unit: 'tissues' },
        summary: 'Fibroblast inclusion improved compaction and beating (synthetic demo values).',
        conclusion: '70:30 ratio adopted as the default casting condition.',
      },
      {
        title: 'Contractile force on flexible posts',
        type: 'Contractility Analysis',
        objective: 'Measure twitch force and beat rate of engineered tissues over time.',
        hypothesis: 'Twitch force increases at least 50% between day 14 and day 21.',
        protocolRef: 'SOP-TE-005 v1',
        conditions: [['Pacing', '1', 'Hz'], ['Timepoints', 'Day 14, 21']],
        inputs: [{ name: 'Engineered heart tissues', type: 'other' }, { name: 'Physiological buffer', type: 'media', identifier: 'MED-TYR-01' }],
        steps: ['Transfer tissues to imaging chamber', 'Record post-deflection videos', 'Compute force from post stiffness'],
        metrics: [
          { name: 'Peak twitch force (day 21)', unit: 'mN', range: [0.18, 0.62], digits: 2, key: true },
          { name: 'Spontaneous beat rate', unit: 'bpm', range: [38, 72], digits: 0 },
        ],
        summary: 'Force increased between timepoints (synthetic demo values).',
        conclusion: 'Tissues suitable for the pacing-regimen comparison.',
      },
      {
        title: 'Maturation markers by qPCR',
        type: 'qPCR / ddPCR',
        objective: 'Quantify maturation-marker expression after electrical pacing.',
        hypothesis: 'Pacing increases the MYH7:MYH6 ratio at least 2-fold.',
        protocolRef: 'SOP-MB-004 v3',
        conditions: [['Housekeeping gene', 'GAPDH'], ['Replicates', '3 tissues × 2 technical']],
        inputs: [{ name: 'RNA extraction kit', type: 'reagent', identifier: 'LOT-RNA-448' }, { name: 'qPCR master mix', type: 'reagent', identifier: 'LOT-QM-2201' }],
        steps: ['Extract RNA', 'Reverse transcribe', 'Run qPCR plate', 'Analyze ΔΔCt'],
        metrics: [{ name: 'MYH7:MYH6 fold change', unit: 'fold', range: [1.4, 3.6], digits: 2, key: true }],
        summary: 'Pacing shifted marker expression toward a more mature profile (synthetic demo values).',
        conclusion: 'Proceed with the escalating pacing regimen.',
      },
      {
        title: 'Sarcomere alignment by imaging',
        type: 'Histology & Imaging',
        objective: 'Quantify sarcomere length and alignment in tissue sections.',
        hypothesis: 'Paced tissues show sarcomere length above 1.9 µm.',
        protocolRef: 'SOP-IM-010 v2',
        conditions: [['Stain', 'α-actinin / DAPI'], ['Fields per tissue', '10']],
        inputs: [{ name: 'Anti-α-actinin antibody', type: 'antibody', identifier: 'AB-ACTN2-03' }, { name: 'Mounting medium', type: 'reagent' }],
        steps: ['Fix and section tissues', 'Immunostain', 'Image on confocal', 'Quantify with image pipeline'],
        metrics: [{ name: 'Sarcomere length', unit: 'µm', range: [1.7, 2.1], digits: 2, key: true }],
        summary: 'Improved alignment in paced tissues (synthetic demo values).',
        conclusion: 'Imaging pipeline validated for routine use.',
      },
    ],
  },
  {
    code: 'GENED-BE',
    name: 'Gene Editing — Base Editor Optimization',
    description:
      'Optimize adenine base editor delivery and guide design to reach > 70% on-target editing with minimal bystander and off-target activity in primary cells.',
    area: 'Genome Editing',
    team: 'genome',
    owner: 'elena',
    status: 'active',
    priority: 'high',
    startOffset: -95,
    targetOffset: 150,
    milestones: [
      { title: 'Guide RNA tiling library designed', dueOffset: -70, status: 'completed', completedOffset: -72 },
      { title: 'On-target editing above 70%', dueOffset: -12, status: 'in_progress' },
      { title: 'Off-target profile characterized', dueOffset: 40, status: 'pending' },
      { title: 'Editing in primary HSPCs', dueOffset: 120, status: 'pending' },
    ],
    experimentCount: 22,
    window: [-90, 25],
    tags: ['method-development', 'replicate', 'milestone-critical', 'dose-response'],
    blueprints: [
      {
        title: 'Guide RNA tiling screen',
        type: 'Genome Editing',
        objective: 'Screen guides tiling the target exon to find the highest-efficiency protospacer.',
        hypothesis: 'Guides positioning the target base at protospacer positions 4–7 edit best.',
        protocolRef: 'SOP-GE-001 v3',
        conditions: [['Guides', '24'], ['Delivery', 'Plasmid lipofection']],
        inputs: [{ name: 'sgRNA plasmid library', type: 'plasmid', identifier: 'LIB-SG-24' }, { name: 'Base editor plasmid', type: 'plasmid', identifier: 'PL-ABE-11' }, { name: 'Reporter cell line', type: 'cell_line', identifier: 'CL-293T-P18' }],
        steps: ['Seed cells', 'Co-transfect editor and guide plasmids', 'Harvest gDNA at 72 h', 'Submit amplicons for sequencing'],
        metrics: [
          { name: 'Best guide editing', unit: '%', range: [52, 81], key: true },
          { name: 'Guides above 40% editing', unit: 'guides', range: [4, 9], digits: 0 },
        ],
        output: { name: 'gDNA, edited pool', type: 'Genomic DNA', unit: 'µL' },
        summary: 'Editing peaked at protospacer positions 5–6 (synthetic demo values).',
        conclusion: 'Top three guides advanced to RNP delivery.',
      },
      {
        title: 'Base editor RNP delivery',
        type: 'Genome Editing',
        objective: 'Compare editing efficiency of top guides delivered as ribonucleoprotein.',
        hypothesis: 'RNP delivery increases editing by ≥ 10 points versus plasmid.',
        protocolRef: 'SOP-GE-004 v2',
        conditions: [['RNP amount', '50', 'pmol'], ['Cells per reaction', '2.0', '×10⁵']],
        inputs: [{ name: 'Base editor protein', type: 'reagent', identifier: 'LOT-ABEP-019' }, { name: 'Synthetic sgRNAs (top 3)', type: 'reagent', identifier: 'SG-TOP3-02' }],
        steps: ['Complex RNP', 'Electroporate cells', 'Recover and culture 72 h', 'Harvest gDNA'],
        metrics: [
          { name: 'On-target editing (best guide)', unit: '%', range: [58, 79], key: true },
          { name: 'Indel frequency', unit: '%', range: [0.2, 1.8], digits: 1 },
        ],
        summary: 'RNP delivery raised editing with low indels (synthetic demo values).',
        conclusion: 'Best guide carried forward; optimize dose to cross 70%.',
      },
      {
        title: 'Amplicon sequencing of edits',
        type: 'NGS Amplicon Sequencing',
        objective: 'Quantify on-target and bystander edits by targeted amplicon sequencing.',
        hypothesis: 'Bystander editing stays below 5% for the lead guide.',
        protocolRef: 'SOP-NGS-002 v4',
        conditions: [['Read length', '2 × 150', 'bp'], ['Target depth', '> 10,000', 'reads']],
        inputs: [{ name: 'Amplicon library prep kit', type: 'reagent', identifier: 'LOT-AMP-771' }, { name: 'Index primers', type: 'reagent' }],
        steps: ['PCR amplify target locus', 'Index and pool libraries', 'Sequence', 'Align and quantify edits'],
        metrics: [
          { name: 'On-target editing', unit: '%', range: [60, 78], key: true },
          { name: 'Bystander editing', unit: '%', range: [1.2, 6.5], digits: 1 },
        ],
        summary: 'On-target editing confirmed with low bystander activity (synthetic demo values).',
        conclusion: 'Data supports progression to off-target nomination.',
      },
      {
        title: 'Off-target nomination and confirmation',
        type: 'NGS Amplicon Sequencing',
        objective: 'Nominate candidate off-target sites and confirm by amplicon sequencing.',
        hypothesis: 'No confirmed off-target site exceeds 0.5% editing.',
        protocolRef: 'SOP-NGS-006 v1',
        conditions: [['Nomination', 'Genome-wide capture'], ['Confirmation sites', 'Top 20']],
        inputs: [{ name: 'Capture reagents', type: 'reagent', identifier: 'LOT-CAP-114' }],
        steps: ['Run nomination assay', 'Rank candidate sites', 'Design confirmation amplicons', 'Sequence and quantify'],
        metrics: [{ name: 'Max confirmed off-target editing', unit: '%', range: [0.05, 0.6], digits: 2, key: true }],
        summary: 'Low-frequency off-target activity at a few sites (synthetic demo values).',
        conclusion: 'Profile acceptable; replicate in primary cells.',
      },
      {
        title: 'Post-electroporation viability',
        type: 'Cell Viability',
        objective: 'Track viability and expansion for 7 days after electroporation.',
        hypothesis: 'Viability recovers to > 85% by day 3.',
        protocolRef: 'SOP-CB-009 v2',
        conditions: [['Timepoints', 'Day 1, 3, 7']],
        inputs: [{ name: 'Viability staining solution', type: 'reagent', identifier: 'LOT-AOPI-332' }],
        steps: ['Count cells at each timepoint', 'Record viability'],
        metrics: [{ name: 'Viability (day 3)', unit: '%', range: [80, 95], key: true }],
        summary: 'Cells recovered quickly after electroporation (synthetic demo values).',
        conclusion: 'Electroporation conditions tolerated.',
      },
    ],
  },
  {
    code: 'BIOMAT-HG',
    name: 'Biomaterial Development — Injectable Hydrogels',
    description:
      'Develop an injectable, photocrosslinkable hydrogel for local cell delivery with tunable stiffness, predictable degradation and sustained growth-factor release.',
    area: 'Biomaterials',
    team: 'biomat',
    owner: 'kenji',
    status: 'active',
    priority: 'medium',
    startOffset: -185,
    targetOffset: 25,
    notes: 'Target date at risk: degradation study repeated after a crosslinker lot change.',
    milestones: [
      { title: 'Formulation space defined', dueOffset: -140, status: 'completed', completedOffset: -138 },
      { title: 'Injectability and gelation validated', dueOffset: -60, status: 'completed', completedOffset: -41 },
      { title: 'Degradation and release profile', dueOffset: -8, status: 'in_progress' },
      { title: 'In vivo compatibility pilot', dueOffset: 22, status: 'pending' },
    ],
    experimentCount: 18,
    window: [-180, 20],
    tags: ['reagent-lot-change', 'replicate', 'pilot', 'follow-up'],
    blueprints: [
      {
        title: 'Polymer concentration series — modulus',
        type: 'Rheology',
        objective: 'Map storage modulus and gelation time across polymer concentrations.',
        hypothesis: 'Storage modulus scales roughly with the square of polymer concentration.',
        protocolRef: 'SOP-BM-003 v2',
        conditions: [['Polymer', '5, 7.5, 10', '% w/v'], ['Light', '405 nm, 30 s']],
        inputs: [{ name: 'Methacryloyl polymer (synthetic lot)', type: 'compound', identifier: 'LOT-GELMA-15' }, { name: 'Photoinitiator', type: 'compound', identifier: 'LOT-LAP-208' }],
        steps: ['Dissolve polymer at 37 °C', 'Load rheometer', 'Time sweep during crosslinking', 'Frequency sweep on gel'],
        metrics: [
          { name: 'Storage modulus (7.5%)', unit: 'Pa', range: [2200, 5600], digits: 0, key: true },
          { name: 'Gelation time (7.5%)', unit: 's', range: [6, 18], digits: 0 },
        ],
        output: { name: 'Hydrogel precursor', type: 'Hydrogel precursor', unit: 'mL' },
        summary: 'Stiffness increased non-linearly with concentration (synthetic demo values).',
        conclusion: '7.5% w/v selected as the baseline formulation.',
      },
      {
        title: 'Injectability through fine needle',
        type: 'Rheology',
        objective: 'Measure injection force and post-injection recovery of the baseline formulation.',
        hypothesis: 'Injection force stays below 20 N at 1 mL/min.',
        protocolRef: 'SOP-BM-006 v1',
        conditions: [['Needle', '27G'], ['Flow rate', '1', 'mL/min']],
        inputs: [{ name: 'Syringes, 1 mL', type: 'consumable' }, { name: 'Hydrogel precursor', type: 'compound' }],
        steps: ['Fill syringes', 'Measure force on mechanical tester', 'Crosslink extruded filament', 'Assess shape fidelity'],
        metrics: [{ name: 'Plateau injection force', unit: 'N', range: [9, 22], digits: 1, key: true }],
        summary: 'Injectable within the target force (synthetic demo values).',
        conclusion: 'Formulation passes the injectability criterion.',
      },
      {
        title: 'Enzymatic degradation study',
        type: 'Degradation & Release',
        objective: 'Characterize mass loss of crosslinked gels over 21 days.',
        hypothesis: 'At least 30% of mass remains at day 14.',
        protocolRef: 'SOP-BM-009 v2',
        conditions: [['Enzyme', '0.5', 'U/mL'], ['Timepoints', 'Day 1, 3, 7, 14, 21']],
        inputs: [{ name: 'Collagenase type II', type: 'reagent', identifier: 'LOT-COL2-667' }, { name: 'Crosslinked hydrogel discs', type: 'other' }],
        steps: ['Cast and crosslink discs', 'Incubate in enzyme solution', 'Lyophilize and weigh at timepoints'],
        metrics: [
          { name: 'Mass remaining (day 14)', unit: '%', range: [24, 58], key: true },
          { name: 'Degradation half-life', unit: 'days', range: [9, 19], digits: 1 },
        ],
        summary: 'Degradation profile sensitive to the crosslinker lot (synthetic demo values).',
        conclusion: 'Repeat with a qualified crosslinker lot before finalizing.',
      },
      {
        title: 'Encapsulated cell viability',
        type: 'Cell Viability',
        objective: 'Assess viability of encapsulated stromal cells over 7 days.',
        hypothesis: 'Viability exceeds 85% at day 7.',
        protocolRef: 'SOP-BM-012 v1',
        conditions: [['Cell density', '5', '×10⁶ cells/mL'], ['Timepoints', 'Day 1, 3, 7']],
        inputs: [{ name: 'Stromal cells (synthetic lot)', type: 'cell_line', identifier: 'MSC-SYN-11' }, { name: 'Live/dead staining kit', type: 'reagent', identifier: 'LOT-LD-909' }],
        steps: ['Encapsulate cells', 'Culture constructs', 'Stain and image', 'Quantify viability'],
        metrics: [{ name: 'Viability (day 7)', unit: '%', range: [80, 95], key: true }],
        summary: 'High viability maintained after encapsulation (synthetic demo values).',
        conclusion: 'Formulation is cytocompatible for cell delivery.',
      },
      {
        title: 'Growth-factor release kinetics',
        type: 'Degradation & Release',
        objective: 'Quantify cumulative growth-factor release from loaded gels over 21 days.',
        hypothesis: 'The 24 h burst release is below 25% of loaded protein.',
        protocolRef: 'SOP-BM-014 v1',
        conditions: [['Loading', '1', 'µg/gel'], ['Sampling', 'Day 1, 3, 7, 14, 21']],
        inputs: [{ name: 'Recombinant growth factor', type: 'reagent', identifier: 'LOT-VEGF-054' }, { name: 'Detection ELISA kit', type: 'reagent', identifier: 'LOT-EL-VEGF-08' }],
        steps: ['Load gels with protein', 'Incubate and sample supernatants', 'Quantify by ELISA'],
        metrics: [
          { name: 'Burst release (24 h)', unit: '%', range: [12, 30], key: true },
          { name: 'Cumulative release (day 21)', unit: '%', range: [55, 82] },
        ],
        summary: 'Sustained release after a modest burst (synthetic demo values).',
        conclusion: 'Release profile suitable for the in vivo pilot.',
      },
    ],
  },
  {
    code: 'ANLT-POT',
    name: 'Potency Assay Development',
    description: 'Develop and qualify a reporter-based potency assay suitable for lot release of cell therapy products.',
    area: 'Analytical Development',
    team: 'analytical',
    owner: 'grace',
    status: 'on_hold',
    priority: 'low',
    startOffset: -110,
    targetOffset: 140,
    notes: 'On hold pending selection of the clinical construct (CART-001 M3).',
    milestones: [
      { title: 'Assay format selected', dueOffset: -60, status: 'completed', completedOffset: -58 },
      { title: 'Qualification protocol approved', dueOffset: 70, status: 'pending' },
    ],
    experimentCount: 6,
    window: [-105, -20],
    tags: ['method-development', 'GLP-ready'],
    blueprints: [
      {
        title: 'Reporter potency assay feasibility',
        type: 'Cytotoxicity Assay',
        objective: 'Evaluate a reporter-based format for measuring CAR-dependent activation.',
        hypothesis: 'The reporter format achieves a signal window above 8-fold.',
        protocolRef: 'AD-POT-001 draft',
        conditions: [['Format', '96-well reporter'], ['Incubation', '6', 'h']],
        inputs: [{ name: 'Reporter cell line (synthetic)', type: 'cell_line', identifier: 'RPT-SYN-02' }],
        steps: ['Plate reporter cells', 'Add effectors at titrated doses', 'Incubate 6 h', 'Read luminescence'],
        metrics: [
          { name: 'Signal window', unit: 'fold', range: [6, 14], digits: 1, key: true },
          { name: 'Z′ factor', unit: 'Z′', range: [0.45, 0.78], digits: 2 },
        ],
        summary: 'Adequate window and Z′ for further development (synthetic demo values).',
        conclusion: 'Format selected for qualification planning.',
      },
      {
        title: 'Intermediate precision study',
        type: 'Cytotoxicity Assay',
        objective: 'Estimate day-to-day and analyst-to-analyst variability.',
        hypothesis: 'Intermediate precision CV is below 20%.',
        protocolRef: 'AD-POT-002 draft',
        conditions: [['Analysts', '2'], ['Days', '3']],
        inputs: [{ name: 'Reference standard (synthetic)', type: 'reagent', identifier: 'RS-SYN-01' }],
        steps: ['Run assay across days and analysts', 'Compute variance components'],
        metrics: [{ name: 'Intermediate precision CV', unit: '%', range: [9, 24], digits: 1, key: true }],
        summary: 'Variability approaching the target limit (synthetic demo values).',
        conclusion: 'Optimize plate layout before qualification.',
      },
    ],
  },
  {
    code: 'AAV-CAP',
    name: 'AAV Capsid Screening Pilot',
    description: 'Pilot screen of engineered AAV capsid variants for improved transduction of a target cell type.',
    area: 'Genome Editing',
    team: 'genome',
    owner: 'elena',
    status: 'completed',
    priority: 'medium',
    startOffset: -260,
    targetOffset: -40,
    completedOffset: -32,
    milestones: [
      { title: 'Capsid library packaged', dueOffset: -210, status: 'completed', completedOffset: -214 },
      { title: 'Top variants identified', dueOffset: -60, status: 'completed', completedOffset: -45 },
    ],
    experimentCount: 8,
    window: [-255, -45],
    tags: ['pilot', 'replicate'],
    blueprints: [
      {
        title: 'Capsid variant packaging titer',
        type: 'qPCR / ddPCR',
        objective: 'Measure genome titers for packaged capsid variants.',
        hypothesis: 'At least 80% of variants package above the titer threshold.',
        protocolRef: 'SOP-VEC-004 v2',
        conditions: [['Variants', '12'], ['Titer method', 'ddPCR (ITR)']],
        inputs: [{ name: 'Capsid variant plasmids', type: 'plasmid', identifier: 'LIB-CAP-12' }, { name: 'Packaging cells', type: 'cell_line', identifier: 'CL-PKG-P09' }],
        steps: ['Triple transfection', 'Harvest and purify', 'Titer by ddPCR'],
        metrics: [{ name: 'Variants above titer threshold', unit: 'variants', range: [8, 11], digits: 0, key: true }],
        summary: 'Most variants packaged efficiently (synthetic demo values).',
        conclusion: 'Titers sufficient to proceed to the transduction screen.',
      },
      {
        title: 'Transduction efficiency screen',
        type: 'In Vitro Transfection',
        objective: 'Rank capsid variants by transduction of the target cell type.',
        hypothesis: 'At least two engineered variants outperform the benchmark capsid.',
        protocolRef: 'SOP-VEC-009 v1',
        conditions: [['MOI', '1e4', 'vg/cell'], ['Readout', 'Reporter expression at 72 h']],
        inputs: [{ name: 'Target cell line (synthetic)', type: 'cell_line', identifier: 'CL-TGT-04' }, { name: 'Reporter assay reagent', type: 'reagent', identifier: 'LOT-LUC-778' }],
        steps: ['Seed target cells', 'Transduce at fixed MOI', 'Incubate 72 h', 'Read reporter expression'],
        metrics: [
          { name: 'Best variant vs benchmark', unit: 'fold', range: [1.2, 3.4], digits: 2, key: true },
          { name: 'Variants above benchmark', unit: 'variants', range: [1, 5], digits: 0 },
        ],
        summary: 'Several engineered variants exceeded the benchmark capsid (synthetic demo values).',
        conclusion: 'Two lead variants nominated for follow-up characterization.',
      },
    ],
  },
];
