/* DCU ECE2 (Electronic & Computer Engineering, Year 2), Semester 1, 2026/27.
   ------------------------------------------------------------------
   Published data, copied on 23 November 2026 from:
     Classes, rooms, teaching weeks  https://mytimetable.dcu.ie (Programmes of study > ECE2, guest view)
     Modules, credits, assessments   https://modspec.dcu.ie (2026/27 module specifications)
     Term dates                      https://www.dcu.ie/registry/academic-calendar-202627
   DCU can change its timetable, so re-check these sources before relying on this snapshot.
   `effort` values and pre-lab / tutorial prep times are TimeStable's planning estimates, not DCU data. */
(() => {
  const TS = window.TS;

  const weeks = (spec) => spec.split(',').flatMap((part) => {
    const [a, b] = part.trim().split('-').map(Number);
    return Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i);
  });
  const spec = (code) => 'https://modspec.dcu.ie/registry/module_contents_akari.php?function=2&subcode=' + code + '&yr=2027';
  const specResource = (code) => [{ title: code + ' module specification 2026/27', kind: 'page', status: 'read', url: spec(code) }];
  const exam = (code, weight) => ({ id: code + '-EX', title: 'End-of-semester exam', kind: 'exam', weight });

  const modules = [
    {
      code: 'EEN1022', name: 'Digital & Analogue Electronics I', ects: 5, lecturer: 'Derek Molloy', hue: 28,
      topics: ['Digital Arithmetic', 'Combinatorial Logic', 'Diode Devices', 'Transistor Devices', 'Sequential Logic', 'Analogue & Digital'],
      lab: { prelab: 45, report: 0 }, tutorialPrep: 30,
      assessments: [
        { id: 'EEN1022-L1', title: 'Lab 1: Logic Gates', kind: 'lab-report', taskType: 'labreport', week: 3, weight: 2.5, effort: 2, note: '10% of the 25% coursework.' },
        { id: 'EEN1022-L2', title: 'Lab 2: The Diode and Combinational Logic', kind: 'lab-report', taskType: 'labreport', week: 5, weight: 2.5, effort: 2, note: '10% of the 25% coursework.' },
        { id: 'EEN1022-L3', title: 'Lab portfolio: The counter', kind: 'lab-report', taskType: 'labreport', week: 7, weight: 2.5, effort: 2, note: '10% of the 25% coursework.' },
        { id: 'EEN1022-L4', title: 'Lab portfolio: The Arduino', kind: 'lab-report', taskType: 'labreport', week: 9, weight: 2.5, effort: 2, note: '10% of the 25% coursework.' },
        { id: 'EEN1022-AS', title: 'Arduino assignment, video demo and report', kind: 'assignment', taskType: 'assignment', week: 10, weight: 2.5, effort: 6, note: '10% of the 25% coursework.' },
        { id: 'EEN1022-QZ', title: 'Loop class tests (weeks 4, 6, 8, 10)', kind: 'quiz', taskType: 'problems', week: 10, weight: 12.5, effort: 2, note: '50% of the 25% coursework. Shown at the last test.' },
        exam('EEN1022', 75),
      ],
    },
    {
      code: 'EEN1018', name: 'Circuits Analysis Techniques', ects: 5, lecturer: 'Leah Ridgway', hue: 205,
      topics: ['Diodes and Non-linear Circuits', 'Loop and Nodal Analysis', 'Superposition', 'Sinusoidal Analysis of RLC Circuits', 'Filters', 'Dependent Voltage and Current Sources', 'Energy and Power Analysis of Circuits'],
      lab: { prelab: 30, report: 0 },
      assessments: [
        { id: 'EEN1018-BT', title: 'Build, test and simulation exercises (×3)', kind: 'assignment', taskType: 'assignment', weight: 50, undated: true, note: 'Deliverables are spread through the semester; no weeks are published.' },
        exam('EEN1018', 50),
      ],
    },
    {
      code: 'EEG1009', name: 'Engineering Mathematics III', ects: 5, lecturer: 'Donnacha Lowney', hue: 85,
      topics: ['Differential equations', 'Partial differentiation', 'Modelling data and approximating functions', 'Coordinate systems', 'Partial differential equations', 'Operators', 'Calculus of vector-valued functions', 'Double and triple integrals', 'Vector calculus'],
      tutorialPrep: 30,
      assessments: [
        { id: 'EEG1009-T1', title: 'In-class test 1', kind: 'quiz', taskType: 'problems', week: 4, weight: 10, effort: 3 },
        { id: 'EEG1009-T2', title: 'In-class test 2', kind: 'quiz', taskType: 'problems', week: 8, weight: 10, effort: 3 },
        exam('EEG1009', 80),
      ],
    },
    {
      code: 'EEN1023', name: 'Data Communications & Networks I', ects: 5, lecturer: 'Jennifer McManis', hue: 150,
      topics: ['Network Design', 'Physical Layer', 'Data Link Layer', 'Data Compression', 'Local Area Networks', 'The Network layer', 'The Internet'],
      lab: { prelab: 30, report: 0 },
      assessments: [
        { id: 'EEN1023-LP', title: 'Lab portfolio: 5 network experiments', kind: 'lab-report', taskType: 'labreport', weight: 25, undated: true, note: 'Due dates are set as required; none are published.' },
        exam('EEN1023', 75),
      ],
    },
    {
      code: 'EEN1091', name: 'C/C++ Programming for Engineers', ects: 5, lecturer: 'Conor Mcardle', hue: 250,
      topics: ['Fundamentals of C', 'Flow Control', 'Functions', 'Pointers, Arrays and Strings in C', 'Elementary Data Structures in C', 'Introduction to C++', 'Classes in C++', 'Dynamic Data Structures in C++', 'Inheritance between Classes in C++'],
      assessments: [
        { id: 'EEN1091-HW', title: 'Homework assignments (×5, 5% each)', kind: 'assignment', taskType: 'programming', weight: 25, undated: true, note: 'Every second week; exact dates are not published.' },
        exam('EEN1091', 75),
      ],
    },
    {
      code: 'ENI1001', name: 'New Enterprise Development Project', ects: 5, lecturer: 'Henrique Machado Barros', hue: 345,
      topics: ['New Business Opportunities', 'Feasibility Study and Market Assessment', 'New Business Planning', 'Legal and Operational Issues', 'Financing a New Business'],
      assessments: [
        { id: 'ENI1001-OP', title: 'Opportunity recognition proposal', kind: 'assignment', taskType: 'assignment', week: 4, weight: 20, effort: 4 },
        { id: 'ENI1001-FS', title: 'Feasibility study', kind: 'assignment', taskType: 'assignment', week: 9, weight: 50, effort: 10 },
        { id: 'ENI1001-BP', title: 'Business plan presentation', kind: 'project', taskType: 'assignment', week: 12, day: 1, time: '16:00', weight: 30, effort: 4,
          flag: 'DCU publishes Week 12 but not the day. TimeStable assumes Tuesday’s 16:00 class, so confirm this with the module team.' },
      ],
    },
  ].map((m) => ({ ...m, page: 'read', official: true, resources: specResource(m.code) }));

  const c = (activity, kind, day, start, end, room, w, extra = {}) => ({ module: activity.slice(0, 7), activity, kind, day, start, end, room, weeks: weeks(w), ...extra });

  const classes = [
    // Monday
    c('EEN1018[1]OC/L1/01', 'lecture', 0, '10:00', '11:00', 'FTG13', '2-7,9-12'),
    c('EEG1009[1]OC/L1/01', 'lecture', 0, '11:00', '13:00', 'SA301', '1-7,9-12'),
    c('EEN1022[1]OC/P1/01', 'lab', 0, '14:00', '17:00', 'SG16, SG15', '1-7,9-12'),
    c('EEG1009[1]OC/P1/01', 'makeup', 0, '17:00', '18:00', 'HG20', '10,12', {
      optional: true,
      flag: { type: 'info', id: 'eeg1009-makeup', message: 'EEG1009 lists CA make-up sessions (Mon 17:00, weeks 10 and 12) and a make-up test (Wed 18:00, week 12). They are unticked because they only apply if you missed a test.' },
    }),
    // Tuesday
    c('EEN1091[1]OC/L1/01', 'lecture', 1, '09:00', '10:00', 'XG21', '1-12'),
    c('EEN1091[1]OC/L2/01', 'lecture', 1, '10:00', '11:00', 'XG22', '1-12'),
    c('EEN1022[1]OC/L1/01', 'lecture', 1, '11:00', '12:00', 'SA301', '1-12'),
    c('EEN1023[1]OC/P1/01', 'lab', 1, '14:00', '16:00', 'S143', '2,4,6,9-10'),
    c('ENI1001[1]OC/L1/01', 'lecture', 1, '16:00', '18:00', 'HG23', '1-6,8-12'),
    // Wednesday
    c('EEN1018[1]OC/P1/01', 'lab', 2, '10:00', '12:00', 'SG16, SG15', '2,4,6,8,10'),
    c('EEN1022[1]OC/L2/01', 'lecture', 2, '12:00', '13:00', 'QG15', '1-3,7'),
    c('EEN1022[1]OC/L2/02', 'lecture', 2, '12:00', '13:00', 'SA101', '4-6,8-12'),
    c('EEG1009[1]OC/L2/01', 'lecture', 2, '14:00', '15:00', 'SA301', '1-12'),
    c('EEG1009[1]OC/T1/01', 'tutorial', 2, '15:00', '16:00', 'SA301', '1-12'),
    c('EEN1018[1]OC/L2/01', 'lecture', 2, '17:00', '18:00', 'SA301', '2-5'),
    c('EEN1018[1]OC/L2/02', 'lecture', 2, '17:00', '18:00', 'FTG11', '6-12'),
    c('EEG1009[1]OC/P1/02', 'makeup', 2, '18:00', '19:00', 'HG20', '12', { optional: true }),
    // Thursday
    c('EEG1009[1]OC/T2/03', 'tutorial', 3, '10:00', '11:00', 'QG27', '1-12'),
    c('EEN1091[1]OC/L3/01', 'lecture', 3, '11:00', '12:00', 'QG13', '1-12'),
    c('EEN1023[1]OC/L1/01', 'lecture', 3, '13:00', '15:00', 'XG16', '1-12'),
    c('EEN1022[1]OC/T1/01', 'tutorial', 3, '17:00', '18:00', 'QG15', '1-12'),
  ];

  TS.dcuEce2 = {
    retrieved: '23 Nov 2026',
    sourceLabel: 'DCU MyTimetable, ECE2, copied 23 Nov 2026',
    week1: new Date(2026, 8, 7).getTime(),          // Monday of teaching week 1
    teachingWeeks: 12,
    examStart: new Date(2026, 11, 7).getTime(),     // exam period 7–19 December 2026
    examEnd: new Date(2026, 11, 19).getTime(),
    modules,
    classes,
  };
})();
