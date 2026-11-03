const student = {
  id: 'student-profile-test-001',
  userId: 'student-user-test-001',
  firstName: 'Amara',
  lastName: 'Ndlovu',
  university: 'University of Cape Town',
  degree: 'BSc Computer Science',
};

const skills = {
  javascript: { id: 'skill-js-test', name: 'JavaScript', category: 'PROGRAMMING' },
  python: { id: 'skill-python-test', name: 'Python', category: 'PROGRAMMING' },
  sql: { id: 'skill-sql-test', name: 'SQL', category: 'DATABASE' },
  react: { id: 'skill-react-test', name: 'React', category: 'FRAMEWORK' },
};

const internship = {
  id: 'internship-test-001',
  title: 'Software Engineering Intern',
  status: 'ACTIVE',
  employerProfileId: 'employer-profile-test-001',
};

const studentSkills = [
  { skillId: skills.javascript.id, proficiency: 'INTERMEDIATE', skill: skills.javascript },
  { skillId: skills.python.id, proficiency: 'BEGINNER', skill: skills.python },
  { skillId: 'skill-react-owned-test', proficiency: 'EXPERT', skill: { id: 'skill-react-owned-test', name: 'React Native', category: 'FRAMEWORK' } },
];

const internshipSkills = [
  { skillId: skills.javascript.id, importance: 5, minimumLevel: 'INTERMEDIATE', skill: skills.javascript },
  { skillId: skills.python.id, importance: 3, minimumLevel: 'ADVANCED', skill: skills.python },
  { skillId: skills.sql.id, importance: 1, minimumLevel: 'BEGINNER', skill: skills.sql },
];

const gapInternships = [
  {
    ...internship,
    title: 'Backend Developer Intern',
    requiredSkills: [
      { skillId: skills.javascript.id, minimumLevel: 'ADVANCED', importance: 3, skill: skills.javascript },
      { skillId: skills.sql.id, minimumLevel: 'BEGINNER', importance: 2, skill: skills.sql },
    ],
  },
  {
    ...internship,
    id: 'internship-test-002',
    title: 'Frontend Developer Intern',
    requiredSkills: [
      { skillId: skills.javascript.id, minimumLevel: 'EXPERT', importance: 4, skill: skills.javascript },
      { skillId: skills.react.id, minimumLevel: 'INTERMEDIATE', importance: 3, skill: skills.react },
    ],
  },
];

module.exports = { student, skills, internship, studentSkills, internshipSkills, gapInternships };