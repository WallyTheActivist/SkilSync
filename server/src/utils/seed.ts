import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './password';
import { getSeedCredentials } from './seedCredentials';

const prisma = new PrismaClient();

type ProficiencyLevel = 'BEGINNER' | 'ELEMENTARY' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
type SkillCategory = 'PROGRAMMING' | 'FRAMEWORK' | 'DATABASE' | 'CLOUD' | 'DEVOPS' | 'DESIGN' | 'SOFT_SKILL' | 'LANGUAGE' | 'TOOL' | 'OTHER';
type InternshipStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'FILLED';

async function main() {
  const seedCredentials = getSeedCredentials(process.env);
  console.log('🌱 Seeding SkillSync database...');

  // ─── Skills ─────────────────────────────────────────────────────────────────
  const skillsData = [
    // Programming Languages
    { name: 'JavaScript', category: 'PROGRAMMING', description: 'Modern web programming language' },
    { name: 'TypeScript', category: 'PROGRAMMING', description: 'Typed superset of JavaScript' },
    { name: 'Python', category: 'PROGRAMMING', description: 'Versatile programming language' },
    { name: 'Java', category: 'PROGRAMMING', description: 'Enterprise programming language' },
    { name: 'C#', category: 'PROGRAMMING', description: 'Microsoft .NET language' },
    { name: 'C++', category: 'PROGRAMMING', description: 'Systems programming language' },
    { name: 'PHP', category: 'PROGRAMMING', description: 'Server-side scripting language' },
    { name: 'Kotlin', category: 'PROGRAMMING', description: 'Modern JVM language for Android' },
    { name: 'Swift', category: 'PROGRAMMING', description: 'Apple ecosystem language' },
    { name: 'Go', category: 'PROGRAMMING', description: 'Google systems language' },
    { name: 'Rust', category: 'PROGRAMMING', description: 'Systems programming with safety' },
    // Frameworks
    { name: 'React', category: 'FRAMEWORK', description: 'UI component library by Meta' },
    { name: 'Angular', category: 'FRAMEWORK', description: 'Full MVC framework by Google' },
    { name: 'Vue.js', category: 'FRAMEWORK', description: 'Progressive JavaScript framework' },
    { name: 'Node.js', category: 'FRAMEWORK', description: 'JavaScript runtime environment' },
    { name: 'Express.js', category: 'FRAMEWORK', description: 'Minimal Node.js web framework' },
    { name: 'Django', category: 'FRAMEWORK', description: 'Python web framework' },
    { name: 'Flask', category: 'FRAMEWORK', description: 'Lightweight Python web framework' },
    { name: 'Spring Boot', category: 'FRAMEWORK', description: 'Java application framework' },
    { name: 'ASP.NET Core', category: 'FRAMEWORK', description: 'Cross-platform .NET framework' },
    { name: 'Next.js', category: 'FRAMEWORK', description: 'React production framework' },
    { name: 'FastAPI', category: 'FRAMEWORK', description: 'Modern Python API framework' },
    // Databases
    { name: 'SQL', category: 'DATABASE', description: 'Structured Query Language' },
    { name: 'MySQL', category: 'DATABASE', description: 'Popular relational database' },
    { name: 'PostgreSQL', category: 'DATABASE', description: 'Advanced open-source database' },
    { name: 'MongoDB', category: 'DATABASE', description: 'NoSQL document database' },
    { name: 'Redis', category: 'DATABASE', description: 'In-memory data store' },
    { name: 'SQLite', category: 'DATABASE', description: 'Lightweight embedded database' },
    { name: 'Prisma', category: 'DATABASE', description: 'Next-gen ORM for Node.js' },
    // Cloud & DevOps
    { name: 'AWS', category: 'CLOUD', description: 'Amazon Web Services' },
    { name: 'Azure', category: 'CLOUD', description: 'Microsoft cloud platform' },
    { name: 'Google Cloud', category: 'CLOUD', description: 'Google cloud platform' },
    { name: 'Docker', category: 'DEVOPS', description: 'Container platform' },
    { name: 'Kubernetes', category: 'DEVOPS', description: 'Container orchestration' },
    { name: 'CI/CD', category: 'DEVOPS', description: 'Continuous integration & delivery' },
    { name: 'Git', category: 'TOOL', description: 'Version control system' },
    { name: 'GitHub', category: 'TOOL', description: 'Code hosting & collaboration' },
    { name: 'Linux', category: 'TOOL', description: 'Open-source operating system' },
    // Design
    { name: 'UI/UX Design', category: 'DESIGN', description: 'User interface & experience design' },
    { name: 'Figma', category: 'DESIGN', description: 'Collaborative design tool' },
    { name: 'Adobe XD', category: 'DESIGN', description: 'UI/UX design tool' },
    { name: 'CSS', category: 'PROGRAMMING', description: 'Stylesheet language' },
    { name: 'TailwindCSS', category: 'FRAMEWORK', description: 'Utility-first CSS framework' },
    // Data Science & AI
    { name: 'Machine Learning', category: 'OTHER', description: 'AI/ML development' },
    { name: 'Data Analysis', category: 'OTHER', description: 'Statistical data analysis' },
    { name: 'Power BI', category: 'TOOL', description: 'Business intelligence tool' },
    { name: 'Tableau', category: 'TOOL', description: 'Data visualization platform' },
    { name: 'TensorFlow', category: 'FRAMEWORK', description: 'Machine learning framework' },
    { name: 'Pandas', category: 'FRAMEWORK', description: 'Python data analysis library' },
    // Soft Skills
    { name: 'Communication', category: 'SOFT_SKILL', description: 'Verbal & written communication' },
    { name: 'Teamwork', category: 'SOFT_SKILL', description: 'Collaborative team player' },
    { name: 'Problem Solving', category: 'SOFT_SKILL', description: 'Analytical thinking' },
    { name: 'Time Management', category: 'SOFT_SKILL', description: 'Effective time management' },
    { name: 'Agile/Scrum', category: 'OTHER', description: 'Agile development methodology' },
    // Security
    { name: 'Cybersecurity', category: 'OTHER', description: 'Information security practices' },
    { name: 'Networking', category: 'OTHER', description: 'Computer networking fundamentals' },
    { name: 'REST API', category: 'OTHER', description: 'RESTful API design & consumption' },
    { name: 'GraphQL', category: 'OTHER', description: 'API query language' },
    { name: 'Cloud Computing', category: 'CLOUD', description: 'Cloud platforms and services' },
    { name: 'Web Development', category: 'PROGRAMMING', description: 'Full-stack web application development' },
  ];

  const skills: Record<string, string> = {};
  for (const s of skillsData) {
    const skill = await prisma.skill.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
    skills[s.name] = skill.id;
  }
  console.log(`✅ Created ${skillsData.length} skills`);

  // ─── Employer Accounts ───────────────────────────────────────────────────────
  const employers = [
    {
      email: seedCredentials.employers[0].email,
      password: await hashPassword(seedCredentials.employers[0].password),
      company: { name: 'TechVision South Africa', industry: 'Software Development', city: 'Cape Town', description: 'Leading software house building enterprise solutions for African markets.' },
    },
    {
      email: seedCredentials.employers[1].email,
      password: await hashPassword(seedCredentials.employers[1].password),
      company: { name: 'DataBridge Analytics', industry: 'Data Science & Analytics', city: 'Johannesburg', description: 'Data-driven insights company specialising in business intelligence and ML.' },
    },
    {
      email: seedCredentials.employers[2].email,
      password: await hashPassword(seedCredentials.employers[2].password),
      company: { name: 'CyberFort Security', industry: 'Cybersecurity', city: 'Pretoria', description: 'Protecting South African businesses with cutting-edge cybersecurity solutions.' },
    },
    {
      email: seedCredentials.employers[3].email,
      password: await hashPassword(seedCredentials.employers[3].password),
      company: { name: 'CloudNine Systems', industry: 'Cloud Infrastructure', city: 'Durban', description: 'Cloud migration and infrastructure management for enterprise clients.' },
    },
    {
      email: seedCredentials.employers[4].email,
      password: await hashPassword(seedCredentials.employers[4].password),
      company: { name: 'Pixel Studio Creative', industry: 'Digital Design & Media', city: 'Cape Town', description: 'Award-winning design agency delivering exceptional digital experiences.' },
    },
  ];

  const employerProfiles: Record<string, string> = {};
  for (const e of employers) {
    const user = await prisma.user.upsert({
      where: { email: e.email },
      update: {},
      create: {
        email: e.email,
        password: e.password,
        role: 'EMPLOYER',
        employerProfile: {
          create: {
            companyName: e.company.name,
            industry: e.company.industry,
            city: e.company.city,
            description: e.company.description,
          },
        },
      },
      include: { employerProfile: true },
    });
    if (user.employerProfile) {
      employerProfiles[e.company.name] = user.employerProfile.id;
    }
  }
  console.log(`✅ Created ${employers.length} employer accounts`);

  // ─── Internships ─────────────────────────────────────────────────────────────
  const deadline = new Date();
  deadline.setMonth(deadline.getMonth() + 2);
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() + 3);

  const internships = [
    // TechVision
    {
      employerName: 'TechVision South Africa',
      data: {
        title: 'Junior Full-Stack Developer Intern',
        description: 'Join our engineering team to build modern web applications using React and Node.js. You will work alongside senior developers on real client projects, contributing to both frontend and backend development.',
        responsibilities: 'Build and maintain React components\nDevelop REST APIs with Node.js/Express\nWrite unit and integration tests\nParticipate in code reviews\nCollaborate in Agile sprints',
        requirements: 'Currently enrolled in Computer Science or IT degree\nStrong understanding of JavaScript fundamentals\nFamiliarity with React or similar frontend framework\nBasic knowledge of SQL databases',
        location: 'Cape Town, South Africa',
        isRemote: false,
        stipend: 8000,
        durationMonths: 6,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Software Development',
        tags: 'fullstack,react,nodejs,javascript',
      },
      skills: [
        { name: 'JavaScript', importance: 5, level: 'INTERMEDIATE' },
        { name: 'React', importance: 5, level: 'ELEMENTARY' },
        { name: 'Node.js', importance: 4, level: 'ELEMENTARY' },
        { name: 'SQL', importance: 3, level: 'BEGINNER' },
        { name: 'Git', importance: 4, level: 'ELEMENTARY' },
        { name: 'REST API', importance: 3, level: 'BEGINNER' },
        { name: 'CSS', importance: 3, level: 'ELEMENTARY' },
      ],
    },
    {
      employerName: 'TechVision South Africa',
      data: {
        title: 'TypeScript Backend Engineer Intern',
        description: 'Work on our microservices architecture and API development. This is an excellent opportunity to gain hands-on experience with enterprise-grade backend systems.',
        responsibilities: 'Develop and maintain TypeScript/Node.js microservices\nDesign and implement RESTful APIs\nOptimise database queries\nWrite comprehensive tests\nDocument APIs using Swagger',
        requirements: 'Strong JavaScript/TypeScript knowledge\nFamiliarity with Node.js\nUnderstanding of REST API principles\nKnowledge of databases (SQL or NoSQL)',
        location: 'Cape Town, South Africa',
        isRemote: true,
        stipend: 9000,
        durationMonths: 6,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Software Development',
        tags: 'typescript,nodejs,backend,api',
      },
      skills: [
        { name: 'TypeScript', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Node.js', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Express.js', importance: 4, level: 'ELEMENTARY' },
        { name: 'PostgreSQL', importance: 4, level: 'ELEMENTARY' },
        { name: 'Git', importance: 4, level: 'ELEMENTARY' },
        { name: 'REST API', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Docker', importance: 3, level: 'BEGINNER' },
      ],
    },
    // DataBridge Analytics
    {
      employerName: 'DataBridge Analytics',
      data: {
        title: 'Data Science Intern',
        description: 'Assist our data science team in building predictive models, analysing large datasets, and creating visualisations that drive business decisions for major South African companies.',
        responsibilities: 'Analyse complex datasets using Python and Pandas\nBuild and evaluate ML models\nCreate interactive dashboards in Power BI or Tableau\nPresent findings to stakeholders\nData cleaning and preprocessing',
        requirements: 'Statistics, Mathematics, or Computer Science background\nProficient in Python\nFamiliarity with Pandas and data analysis libraries\nBasic understanding of machine learning concepts',
        location: 'Johannesburg, South Africa',
        isRemote: false,
        stipend: 7500,
        durationMonths: 6,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Data Science & Analytics',
        tags: 'python,datascience,ml,analytics',
      },
      skills: [
        { name: 'Python', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Pandas', importance: 5, level: 'ELEMENTARY' },
        { name: 'Data Analysis', importance: 5, level: 'ELEMENTARY' },
        { name: 'Machine Learning', importance: 4, level: 'BEGINNER' },
        { name: 'SQL', importance: 4, level: 'ELEMENTARY' },
        { name: 'Power BI', importance: 3, level: 'BEGINNER' },
        { name: 'Communication', importance: 3, level: 'INTERMEDIATE' },
      ],
    },
    {
      employerName: 'DataBridge Analytics',
      data: {
        title: 'Business Intelligence Developer Intern',
        description: 'Join our BI team to build reports and dashboards that help clients make data-driven decisions. You will work with large enterprise datasets and cutting-edge visualisation tools.',
        responsibilities: 'Design and develop Power BI dashboards\nWrite complex SQL queries\nData modelling and ETL processes\nCollaborate with business analysts\nDocument data pipelines',
        requirements: 'Strong SQL skills\nFamiliarity with Power BI or Tableau\nUnderstanding of data warehousing concepts\nAttention to detail',
        location: 'Johannesburg, South Africa',
        isRemote: false,
        stipend: 7000,
        durationMonths: 4,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Data Science & Analytics',
        tags: 'powerbi,sql,bi,analytics',
      },
      skills: [
        { name: 'SQL', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Power BI', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Data Analysis', importance: 4, level: 'ELEMENTARY' },
        { name: 'Python', importance: 3, level: 'BEGINNER' },
        { name: 'Communication', importance: 4, level: 'INTERMEDIATE' },
        { name: 'Problem Solving', importance: 4, level: 'INTERMEDIATE' },
      ],
    },
    // CyberFort Security
    {
      employerName: 'CyberFort Security',
      data: {
        title: 'Cybersecurity Analyst Intern',
        description: 'Gain hands-on experience in protecting digital infrastructure. You will assist our security team with threat analysis, vulnerability assessments, and security monitoring.',
        responsibilities: 'Monitor security systems and alerts\nConduct vulnerability assessments\nAssist with penetration testing\nDocument security incidents\nImplement security best practices',
        requirements: 'IT, Computer Science or Cybersecurity studies\nBasic networking knowledge\nFamiliarity with Linux systems\nKnowledge of cybersecurity principles',
        location: 'Pretoria, South Africa',
        isRemote: false,
        stipend: 8500,
        durationMonths: 6,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Cybersecurity',
        tags: 'cybersecurity,networking,linux,security',
      },
      skills: [
        { name: 'Cybersecurity', importance: 5, level: 'ELEMENTARY' },
        { name: 'Networking', importance: 5, level: 'ELEMENTARY' },
        { name: 'Linux', importance: 4, level: 'ELEMENTARY' },
        { name: 'Python', importance: 3, level: 'BEGINNER' },
        { name: 'Problem Solving', importance: 4, level: 'INTERMEDIATE' },
        { name: 'Communication', importance: 3, level: 'INTERMEDIATE' },
      ],
    },
    // CloudNine Systems
    {
      employerName: 'CloudNine Systems',
      data: {
        title: 'Cloud Infrastructure Intern',
        description: 'Work with our cloud engineering team on AWS and Azure infrastructure projects. Help design, deploy, and manage cloud resources for enterprise clients.',
        responsibilities: 'Assist with cloud resource provisioning on AWS/Azure\nConfigure CI/CD pipelines\nMonitor and optimise cloud infrastructure\nDocument infrastructure as code\nAssist with Docker container management',
        requirements: 'IT or Computer Science background\nBasic Linux/Unix command line skills\nFamiliarity with cloud platforms (AWS/Azure)\nKnowledge of networking fundamentals',
        location: 'Durban, South Africa',
        isRemote: true,
        stipend: 9000,
        durationMonths: 6,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Cloud Infrastructure',
        tags: 'aws,azure,cloud,devops,docker',
      },
      skills: [
        { name: 'AWS', importance: 5, level: 'ELEMENTARY' },
        { name: 'Linux', importance: 4, level: 'INTERMEDIATE' },
        { name: 'Docker', importance: 4, level: 'ELEMENTARY' },
        { name: 'Networking', importance: 4, level: 'ELEMENTARY' },
        { name: 'CI/CD', importance: 3, level: 'BEGINNER' },
        { name: 'Python', importance: 3, level: 'BEGINNER' },
        { name: 'Git', importance: 3, level: 'ELEMENTARY' },
      ],
    },
    {
      employerName: 'CloudNine Systems',
      data: {
        title: 'DevOps Engineer Intern',
        description: 'Join our DevOps team to streamline deployment pipelines and improve development workflows. You will work on automation, containerisation, and monitoring solutions.',
        responsibilities: 'Build and maintain CI/CD pipelines\nManage Docker containers and Kubernetes clusters\nAutomate deployment processes\nMonitor application performance\nCollaborate with development teams',
        requirements: 'Knowledge of Docker and containerisation\nFamiliarity with CI/CD concepts\nBasic scripting skills (Python or Bash)\nUnderstanding of cloud platforms',
        location: 'Durban, South Africa',
        isRemote: true,
        stipend: 9500,
        durationMonths: 6,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Cloud Infrastructure',
        tags: 'devops,docker,kubernetes,cicd',
      },
      skills: [
        { name: 'Docker', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Kubernetes', importance: 4, level: 'BEGINNER' },
        { name: 'CI/CD', importance: 5, level: 'ELEMENTARY' },
        { name: 'Linux', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Python', importance: 3, level: 'ELEMENTARY' },
        { name: 'AWS', importance: 3, level: 'ELEMENTARY' },
        { name: 'Git', importance: 4, level: 'INTERMEDIATE' },
      ],
    },
    // Pixel Studio
    {
      employerName: 'Pixel Studio Creative',
      data: {
        title: 'UI/UX Design Intern',
        description: 'Join our award-winning design team to create beautiful, user-centred digital experiences. Work on real client projects spanning mobile apps, websites, and brand identity.',
        responsibilities: 'Create wireframes and interactive prototypes in Figma\nConduct user research and usability testing\nDesign responsive web and mobile interfaces\nCollaborate with developers on implementation\nMaintain design systems',
        requirements: 'Studying Graphic Design, HCI, or related field\nProficient in Figma or Adobe XD\nPortfolio demonstrating UI/UX work\nUnderstanding of user-centred design principles',
        location: 'Cape Town, South Africa',
        isRemote: false,
        stipend: 7000,
        durationMonths: 4,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Digital Design & Media',
        tags: 'ux,ui,figma,design',
      },
      skills: [
        { name: 'UI/UX Design', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Figma', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Communication', importance: 4, level: 'INTERMEDIATE' },
        { name: 'Adobe XD', importance: 3, level: 'ELEMENTARY' },
        { name: 'CSS', importance: 3, level: 'ELEMENTARY' },
        { name: 'Problem Solving', importance: 4, level: 'INTERMEDIATE' },
      ],
    },
    {
      employerName: 'Pixel Studio Creative',
      data: {
        title: 'Frontend Developer Intern',
        description: 'Build pixel-perfect web interfaces from our design system. Work closely with designers and backend developers to deliver exceptional user experiences.',
        responsibilities: 'Implement responsive web interfaces using React and TailwindCSS\nConvert Figma designs to clean code\nEnsure cross-browser compatibility\nOptimise frontend performance\nParticipate in design reviews',
        requirements: 'Strong HTML, CSS, and JavaScript skills\nFamiliarity with React\nEye for design and attention to detail\nFamiliarity with Figma or similar tools',
        location: 'Cape Town, South Africa',
        isRemote: false,
        stipend: 8000,
        durationMonths: 6,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Digital Design & Media',
        tags: 'frontend,react,css,tailwind',
      },
      skills: [
        { name: 'JavaScript', importance: 5, level: 'INTERMEDIATE' },
        { name: 'React', importance: 5, level: 'INTERMEDIATE' },
        { name: 'CSS', importance: 5, level: 'INTERMEDIATE' },
        { name: 'TailwindCSS', importance: 4, level: 'ELEMENTARY' },
        { name: 'Figma', importance: 3, level: 'BEGINNER' },
        { name: 'Git', importance: 3, level: 'ELEMENTARY' },
        { name: 'TypeScript', importance: 3, level: 'ELEMENTARY' },
      ],
    },
    {
      employerName: 'DataBridge Analytics',
      data: {
        title: 'Machine Learning Engineer Intern',
        description: 'Work with our AI team to develop and deploy machine learning models that solve real business problems for clients across banking, retail, and healthcare sectors.',
        responsibilities: 'Build and train ML models using Python and TensorFlow\nFeature engineering and data preprocessing\nModel evaluation and performance tuning\nDeploy models to production APIs\nDocument model architectures',
        requirements: 'Mathematics, Statistics or CS background\nProficient in Python\nFamiliarity with TensorFlow or PyTorch\nGood understanding of ML algorithms',
        location: 'Johannesburg, South Africa',
        isRemote: false,
        stipend: 10000,
        durationMonths: 6,
        startDate,
        applicationDeadline: deadline,
        status: 'ACTIVE',
        industry: 'Data Science & Analytics',
        tags: 'ml,tensorflow,python,ai',
      },
      skills: [
        { name: 'Python', importance: 5, level: 'ADVANCED' },
        { name: 'TensorFlow', importance: 5, level: 'ELEMENTARY' },
        { name: 'Machine Learning', importance: 5, level: 'INTERMEDIATE' },
        { name: 'Pandas', importance: 4, level: 'INTERMEDIATE' },
        { name: 'Data Analysis', importance: 4, level: 'INTERMEDIATE' },
        { name: 'SQL', importance: 3, level: 'ELEMENTARY' },
        { name: 'Git', importance: 3, level: 'ELEMENTARY' },
      ],
    },
  ];

  for (const intern of internships) {
    const empId = employerProfiles[intern.employerName];
    if (!empId) continue;
    const created = await prisma.internship.create({
      data: {
        ...intern.data,
        employerProfileId: empId,
      },
    });
    for (const s of intern.skills) {
      const skillId = skills[s.name];
      if (!skillId) continue;
      await prisma.internshipSkill.create({
        data: {
          internshipId: created.id,
          skillId,
          importance: s.importance,
          minimumLevel: s.level,
        },
      });
    }
  }
  console.log(`✅ Created ${internships.length} internships`);

  // ─── Demo Student Account ────────────────────────────────────────────────────
  const demoStudent = await prisma.user.upsert({
    where: { email: seedCredentials.students[0].email },
    update: {},
    create: {
      email: seedCredentials.students[0].email,
      password: await hashPassword(seedCredentials.students[0].password),
      role: 'STUDENT',
      studentProfile: {
        create: {
          firstName: 'Alex',
          lastName: 'Johnson',
          phone: '+27 71 234 5678',
          university: 'Richfield Graduate Institute of Technology',
          faculty: 'Faculty of Information Technology',
          degree: 'BSc Information Technology',
          yearOfStudy: 3,
          gpa: 3.6,
          bio: 'Passionate full-stack developer with a strong interest in building scalable web applications. Eager to apply my skills in a real-world environment.',
          linkedIn: 'https://linkedin.com/in/alexjohnson',
          github: 'https://github.com/alexjohnson',
          city: 'Cape Town',
          country: 'South Africa',
        },
      },
    },
    include: { studentProfile: true },
  });

  if (demoStudent.studentProfile) {
    const profile = demoStudent.studentProfile;
    const demoSkills = [
      { name: 'JavaScript', level: 'ADVANCED', years: 2.5 },
      { name: 'TypeScript', level: 'INTERMEDIATE', years: 1.5 },
      { name: 'React', level: 'ADVANCED', years: 2 },
      { name: 'Node.js', level: 'INTERMEDIATE', years: 1.5 },
      { name: 'Python', level: 'ELEMENTARY', years: 0.5 },
      { name: 'SQL', level: 'INTERMEDIATE', years: 1 },
      { name: 'Git', level: 'INTERMEDIATE', years: 2 },
      { name: 'CSS', level: 'ADVANCED', years: 2.5 },
      { name: 'REST API', level: 'INTERMEDIATE', years: 1 },
      { name: 'Agile/Scrum', level: 'ELEMENTARY', years: 0.5 },
      { name: 'Communication', level: 'INTERMEDIATE', years: 3 },
      { name: 'Problem Solving', level: 'ADVANCED', years: 3 },
    ];
    for (const ds of demoSkills) {
      const skillId = skills[ds.name];
      if (!skillId) continue;
      await prisma.studentSkill.upsert({
        where: { studentProfileId_skillId: { studentProfileId: profile.id, skillId } },
        update: {},
        create: {
          studentProfileId: profile.id,
          skillId,
          proficiency: ds.level,
          yearsExperience: ds.years,
        },
      });
    }
  }
  console.log('✅ Created demo student account');

  // Second demo student
  const demoStudent2 = await prisma.user.upsert({
    where: { email: seedCredentials.students[1].email },
    update: {},
    create: {
      email: seedCredentials.students[1].email,
      password: await hashPassword(seedCredentials.students[1].password),
      role: 'STUDENT',
      studentProfile: {
        create: {
          firstName: 'Priya',
          lastName: 'Naidoo',
          phone: '+27 82 345 6789',
          university: 'Richfield Graduate Institute of Technology',
          faculty: 'Faculty of Science',
          degree: 'BSc Computer Science',
          yearOfStudy: 3,
          gpa: 3.8,
          bio: 'Data science enthusiast with a passion for using machine learning to solve real-world problems.',
          city: 'Johannesburg',
          country: 'South Africa',
        },
      },
    },
    include: { studentProfile: true },
  });

  if (demoStudent2.studentProfile) {
    const profile = demoStudent2.studentProfile;
    const demoSkills2 = [
      { name: 'Python', level: 'ADVANCED', years: 2 },
      { name: 'Pandas', level: 'INTERMEDIATE', years: 1.5 },
      { name: 'Data Analysis', level: 'INTERMEDIATE', years: 1 },
      { name: 'Machine Learning', level: 'ELEMENTARY', years: 0.5 },
      { name: 'SQL', level: 'ADVANCED', years: 2 },
      { name: 'TensorFlow', level: 'BEGINNER', years: 0.3 },
      { name: 'Communication', level: 'ADVANCED', years: 3 },
      { name: 'Problem Solving', level: 'ADVANCED', years: 3 },
    ];
    for (const ds of demoSkills2) {
      const skillId = skills[ds.name];
      if (!skillId) continue;
      await prisma.studentSkill.upsert({
        where: { studentProfileId_skillId: { studentProfileId: profile.id, skillId } },
        update: {},
        create: {
          studentProfileId: profile.id,
          skillId,
          proficiency: ds.level,
          yearsExperience: ds.years,
        },
      });
    }
  }
  console.log('✅ Created second demo student');

  // ─── Admin Account ───────────────────────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({ where: { email: seedCredentials.admin.email } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: seedCredentials.admin.email,
        password: await hashPassword(seedCredentials.admin.password),
        role: 'ADMIN',
      },
    });
  }
  console.log('✅ Ensured configured admin account exists');

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
