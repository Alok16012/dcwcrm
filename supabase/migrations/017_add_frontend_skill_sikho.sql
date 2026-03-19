-- Add Frontend Skill Sikho course
INSERT INTO courses (name) VALUES ('Frontend Skill Sikho');

-- Add sub-courses for Frontend Skill Sikho
INSERT INTO sub_courses (course_id, name)
SELECT c.id, s.name
FROM courses c
CROSS JOIN (
  VALUES 
    ('React.js'),
    ('HTML & CSS'),
    ('JavaScript Fundamentals'),
    ('Next.js'),
    ('TypeScript')
) AS s(name)
WHERE c.name = 'Frontend Skill Sikho';
