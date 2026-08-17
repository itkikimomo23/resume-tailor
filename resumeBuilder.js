/**
 * resumeBuilder.js
 * ----------------
 * Generates a .docx resume matching the Benjamin Dong template format.
 *
 * Install:  npm install docx
 * Run:      node resumeBuilder.js
 *
 * Or import buildResumeBuffer() / buildResume() into your own program.
 */

const fs = require("fs");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  TabStopType,
  LevelFormat,
  BorderStyle,
} = require("docx");

// ─── Page geometry (DXA units; 1440 DXA = 1 inch) ────────────────────────────
const PAGE_W      = 12240;  // 8.5 in
const PAGE_H      = 15840;  // 11  in
const MARGIN_TOP  =  1080;  // 0.75 in
const MARGIN_SIDE =  1080;  // 0.75 in
const CONTENT_W   = PAGE_W - MARGIN_SIDE * 2;  // 10,080 DXA ≈ 7 in

// ─── Paragraph helpers ───────────────────────────────────────────────────────

/**
 * Header block: Name (16 pt) / Title / Contact — all centered.
 */
function headerParagraph(name, title, contact) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0, line: 276, lineRule: "auto" },
    children: [
      new TextRun({ text: name, size: 32 }),
      new TextRun({ text: "", break: 1 }),
      new TextRun({ text: title, size: 21 }),
      new TextRun({ text: "", break: 1 }),
      new TextRun({ text: contact, size: 20 }),
    ],
  });
}

/**
 * Section header: bold Montserrat, bottom border divider.
 */
function sectionHeader(text) {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 1 },
    },
    spacing: { before: 200, after: 0 },
    children: [
      new TextRun({ text, font: "Montserrat", bold: true, size: 21 }),
    ],
  });
}

/**
 * Skill line: bold category label + regular items.
 */
function skillLine(category, items) {
  return new Paragraph({
    spacing: { before: 40, after: 0 },
    children: [
      new TextRun({ text: category + ": ", bold: true, size: 21 }),
      new TextRun({ text: items, size: 21 }),
    ],
  });
}

/**
 * Job header row: company|location on the left, dates on the right.
 */
function jobHeaderLine(company, location, startDate, endDate) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
    spacing: { before: 100, after: 0 },
    children: [
      new TextRun({ text: company, bold: true, size: 21 }),
      new TextRun({ text: ` | ${location}`, size: 21 }),
      new TextRun({ text: "\t", size: 21 }),
      new TextRun({ text: `${startDate} – ${endDate}`, size: 21 }),
    ],
  });
}

/**
 * Job title row (italic, directly below the job header).
 */
function jobTitleLine(title) {
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: title, italics: true, size: 21 })],
  });
}

/**
 * Bullet point — uses OOXML numbered list (reference: "resume-bullets").
 */
function bulletPoint(text) {
  return new Paragraph({
    numbering: { reference: "resume-bullets", level: 0 },
    spacing: { before: 0, after: 40 },
    children: [new TextRun({ text, size: 21 })],
  });
}

/**
 * Education row: degree on the left, dates on the right.
 * Returns an array of two Paragraphs.
 */
function educationEntry(degree, school, startDate, endDate, gpa) {
  const gradeRun = gpa
    ? [new TextRun({ text: `  Grade: ${gpa}`, size: 21 })]
    : [];

  return [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
      spacing: { before: 80, after: 0 },
      children: [
        new TextRun({ text: degree, size: 21 }),
        new TextRun({ text: "\t", size: 21 }),
        new TextRun({ text: `${startDate} – ${endDate}`, size: 21 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: school, bold: true, size: 21 }),
        ...gradeRun,
      ],
    }),
  ];
}

// ─── Document assembly ────────────────────────────────────────────────────────

function _buildDocument(data) {
  const children = [];

  children.push(headerParagraph(data.name, data.title, data.contact));

  children.push(sectionHeader("SUMMARY"));
  children.push(
    new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text: data.summary, size: 21 })],
    })
  );

  children.push(sectionHeader("SKILLS"));
  data.skills.forEach(({ category, items }) => {
    children.push(skillLine(category, items));
  });

  children.push(sectionHeader("PROFESSIONAL EXPERIENCE"));
  data.experience.forEach((job) => {
    children.push(jobHeaderLine(job.company, job.location, job.startDate, job.endDate));
    children.push(jobTitleLine(job.title));
    job.bullets.forEach((b) => children.push(bulletPoint(b)));
  });

  children.push(sectionHeader("EDUCATION"));
  data.education.forEach((edu) => {
    educationEntry(edu.degree, edu.school, edu.startDate, edu.endDate, edu.gpa)
      .forEach((p) => children.push(p));
  });

  return new Document({
    numbering: {
      config: [
        {
          reference: "resume-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 360, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: {
              top:    MARGIN_TOP,
              bottom: MARGIN_TOP,
              left:   MARGIN_SIDE,
              right:  MARGIN_SIDE,
            },
          },
        },
        children,
      },
    ],
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build resume and return the raw .docx buffer (for web/API use).
 *
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.title
 * @param {string} data.contact
 * @param {string} data.summary
 * @param {Array}  data.skills       [{category, items}]
 * @param {Array}  data.experience   [{company, location, startDate, endDate, title, bullets:[]}]
 * @param {Array}  data.education    [{degree, school, startDate, endDate, gpa?}]
 * @returns {Promise<Buffer>}
 */
async function buildResumeBuffer(data) {
  return await Packer.toBuffer(_buildDocument(data));
}

/**
 * Build and write a tailored resume .docx file (CLI use).
 *
 * @param {Object} data         See buildResumeBuffer() for full schema.
 * @param {string} [outputPath] Defaults to "<name>_resume.docx"
 * @returns {Promise<string>}   Path of the written file.
 */
async function buildResume(data, outputPath) {
  const buffer = await buildResumeBuffer(data);
  const filePath = outputPath || `${data.name.replace(/\s+/g, "_")}_resume.docx`;
  fs.writeFileSync(filePath, buffer);
  console.log(`✓  Written: ${filePath}`);
  return filePath;
}

module.exports = { buildResume, buildResumeBuffer };

// ─── Example / demo ───────────────────────────────────────────────────────────
// Runs only when this file is executed directly: node resumeBuilder.js

if (require.main === module) {
  const EXAMPLE_DATA = {
    name:    "Jane Smith",
    title:   "Senior Software Engineer",
    contact: "jane@example.com  •  San Francisco, CA  •  linkedin.com/in/janesmith",

    summary:
      "Full-stack engineer with 7+ years building scalable web products at Series A–C " +
      "startups. Specialises in React, Node.js, and cloud-native architectures. " +
      "Passionate about developer experience and shipping fast without breaking things.",

    skills: [
      { category: "Frontend",        items: "React, Next.js, TypeScript, Tailwind CSS" },
      { category: "Backend",         items: "Node.js, Python, FastAPI, PostgreSQL, Redis" },
      { category: "Infrastructure",  items: "AWS, Docker, Kubernetes, Terraform, GitHub Actions" },
      { category: "Practices",       items: "TDD, CI/CD, code review, Agile/Scrum" },
    ],

    experience: [
      {
        company:   "Acme Corp",
        location:  "San Francisco, CA (Hybrid)",
        startDate: "06/2021",
        endDate:   "Present",
        title:     "Senior Software Engineer",
        bullets: [
          "Led redesign of the checkout flow, reducing drop-off by 18% and increasing conversion by $2 M ARR.",
          "Migrated monolithic Rails app to a Next.js + FastAPI microservices architecture, cutting p95 latency from 900 ms to 140 ms.",
          "Introduced end-to-end testing with Playwright; raised coverage from 12% to 87% in one quarter.",
          "Mentored 4 junior engineers through weekly 1:1s and structured code-review sessions.",
        ],
      },
      {
        company:   "Beta Labs",
        location:  "Remote",
        startDate: "02/2018",
        endDate:   "05/2021",
        title:     "Software Engineer",
        bullets: [
          "Built the real-time collaboration engine powering 50 k concurrent users using WebSockets and Redis Streams.",
          "Owned the data pipeline (Kafka → dbt → Snowflake) that fed the company's core analytics dashboard.",
          "Reduced cloud spend by 31% by right-sizing EC2 fleets and adopting Spot Instances for batch workloads.",
        ],
      },
    ],

    education: [
      {
        degree:    "B.S. Computer Science",
        school:    "Stanford University",
        startDate: "09/2013",
        endDate:   "06/2017",
        gpa:       "3.9/4.0",
      },
    ],
  };

  buildResume(EXAMPLE_DATA, "jane_smith_resume.docx").catch(console.error);
}
