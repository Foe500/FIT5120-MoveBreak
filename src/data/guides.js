const commonStopConditions = [
  'Pain or discomfort that starts or becomes worse while you move.',
  'Feeling lightheaded, dizzy, faint or generally unwell.',
  'Chest pain or tightness, unusual shortness of breath, or a very rapid or irregular heartbeat.',
]

const emergencyAdvice =
  'Call triple zero (000) if chest pain is severe, gets worse or lasts longer than 10 minutes.'

const activitySafetySources = [
  {
    publisher: 'Better Health Channel',
    title: 'Exercise safety',
    url: 'https://www.betterhealth.vic.gov.au/health/healthyliving/exercise-safety',
  },
  {
    publisher: 'Healthdirect Australia',
    title: 'Chest pain',
    url: 'https://www.healthdirect.gov.au/chest-pain',
  },
]

export const guides = [
  {
    id: 'eyes',
    title: 'Eyes',
    description: 'Screen habits and time away from your display.',
    tone: 'blue',
    scenario:
      'You have been concentrating on a screen for a while and your eyes feel dry, tired or slow to refocus.',
    introduction:
      'Close-up screen work can make your eyes feel uncomfortable. Concentrating on a display can also reduce blinking, especially in a heated or air-conditioned workspace.',
    sections: [
      {
        title: 'Reset your focus',
        body: 'Pause screen work regularly and look around at objects at different distances. Give your eyes a moment to refocus before returning to the task.',
      },
      {
        title: 'Reduce avoidable strain',
        body: 'Blink deliberately, reduce glare on the screen and make sure the room is comfortably lit. Position the screen directly in front of you at a comfortable viewing distance.',
      },
      {
        title: 'Respond to ongoing symptoms',
        body: 'If tired, sore or blurry eyes continue after a break, speak with an optometrist to check for an underlying vision or eye-health issue.',
      },
    ],
    sources: [
      {
        publisher: 'Better Health Channel',
        title: 'Eyes – common problems',
        url: 'https://www.betterhealth.vic.gov.au/health/conditionsandtreatments/eyes-common-problems',
      },
      {
        publisher: 'Safe Work Australia',
        title: 'Setting up your workstation infographic',
        url: 'https://www.safeworkaustralia.gov.au/doc/setting-your-workstation-infographic',
      },
    ],
  },
  {
    id: 'posture',
    title: 'Posture',
    description: 'Sitting, standing and changing position during your workday.',
    tone: 'green',
    scenario:
      'You notice that your shoulders are raised, your back is slouched or you have stayed in one position for a long time.',
    introduction:
      'A comfortable starting posture can reduce unnecessary effort, but movement matters too. A workstation should let you change position instead of holding one posture all day.',
    sections: [
      {
        title: 'Find a neutral starting point',
        body: 'Relax your shoulders, keep your head balanced over your body and support your lower back. Keep your feet on the floor or use a footrest.',
      },
      {
        title: 'Change position often',
        body: 'Shift between comfortable positions during the day. Stand for a phone call, walk to speak with a colleague or change tasks when you have been sitting for a while.',
      },
      {
        title: 'Let the workstation support you',
        body: 'Bring frequently used equipment within easy reach. Adjust the chair, screen and input devices so you do not need to lean, twist or reach repeatedly.',
      },
    ],
    activitySafety: {
      comfortableRange:
        'Move gently through positions that feel easy and controlled. Change position before discomfort builds, and never force a stretch or hold a posture that hurts.',
      stopConditions: commonStopConditions,
      emergencyAdvice,
    },
    sources: [
      {
        publisher: 'Safe Work Australia',
        title: 'Sitting and standing',
        url: 'https://www.safeworkaustralia.gov.au/safety-topic/hazards/sitting-and-standing',
      },
      ...activitySafetySources,
      {
        publisher: 'Safe Work Australia',
        title: 'Setting up your workstation infographic',
        url: 'https://www.safeworkaustralia.gov.au/doc/setting-your-workstation-infographic',
      },
    ],
  },
  {
    id: 'desk-setup',
    title: 'Desk Setup',
    description: 'Your chair, screen and everyday workspace essentials.',
    tone: 'coral',
    scenario:
      'You are starting work at a new desk, using a temporary setup or feeling discomfort while using your usual equipment.',
    introduction:
      'A workstation should fit the work you do, the space you use and your individual needs. Small adjustments can make the screen, chair, keyboard and mouse easier to use.',
    sections: [
      {
        title: 'Place the screen',
        body: 'Put the screen directly in front of you, about an arm’s length away, with your eye level slightly below the top of the display. Reduce reflections and glare where possible.',
      },
      {
        title: 'Support your body',
        body: 'Use the backrest to support your lower back. Keep your feet supported and bring the chair close enough that you can use the desk without leaning forward.',
      },
      {
        title: 'Arrange your tools',
        body: 'Keep the keyboard and mouse close and easy to reach. Aim for relaxed shoulders, forearms angled slightly down and wrists in a neutral position.',
      },
    ],
    sources: [
      {
        publisher: 'Safe Work Australia',
        title: 'Setting up your workstation infographic',
        url: 'https://www.safeworkaustralia.gov.au/doc/setting-your-workstation-infographic',
      },
      {
        publisher: 'Better Health Channel',
        title: 'Computer-related injuries',
        url: 'https://www.betterhealth.vic.gov.au/site-5/health/healthyliving/computer-related-injuries',
      },
    ],
  },
  {
    id: 'movement',
    title: 'Movement',
    description: 'Small opportunities to move throughout your workday.',
    tone: 'coral',
    scenario:
      'A focused task has kept you seated for a long stretch and you want a realistic way to add movement without disrupting your day.',
    introduction:
      'Regular exercise and active breaks play different roles. Australian guidance recommends limiting sedentary time and breaking up prolonged periods of sitting as often as possible.',
    sections: [
      {
        title: 'Interrupt long sitting periods',
        body: 'Use natural transition points—after a meeting, task or call—to stand, stretch or walk briefly before beginning the next activity.',
      },
      {
        title: 'Choose movement that fits',
        body: 'Walk while taking a call, use stairs when suitable or complete a short mobility break. Light activity still replaces sedentary time and can be added throughout the day.',
      },
      {
        title: 'Build a broader routine',
        body: 'Aim to be active on most days and include a mix of light activity, moderate-to-vigorous activity, strength, mobility and balance across the week.',
      },
    ],
    activitySafety: {
      comfortableRange:
        'Start with light, controlled movement that lets you breathe comfortably and speak in full sentences. Use a smaller range, slower pace or shorter break whenever you need it.',
      stopConditions: commonStopConditions,
      emergencyAdvice,
    },
    sources: [
      {
        publisher: 'Australian Government Department of Health, Disability and Ageing',
        title: 'Recommendations for adults aged 18 to 64 years',
        url: 'https://www.health.gov.au/topics/physical-activity/24-hour-movement-guidelines-for-all-australians/recommendations-for-adults-18-to-64-years',
      },
      {
        publisher: 'Safe Work Australia',
        title: 'Sitting and standing',
        url: 'https://www.safeworkaustralia.gov.au/safety-topic/hazards/sitting-and-standing',
      },
      ...activitySafetySources,
    ],
  },
  {
    id: 'outdoor-break',
    title: 'Outdoor Break',
    description: 'Time outside and a change of scene between tasks.',
    tone: 'green',
    scenario:
      'You feel mentally stuck or low on energy and have a few minutes to step away from your indoor workspace.',
    introduction:
      'An outdoor break can combine a change of setting with light movement. Access to parks, open space and opportunities to connect with nature supports active living and wellbeing.',
    sections: [
      {
        title: 'Choose a simple destination',
        body: 'Use a nearby courtyard, tree-lined street or public open space. Pick a route that fits the time available so the break feels easy to complete.',
      },
      {
        title: 'Let the setting change',
        body: 'Put the screen away, notice the surroundings and walk at a comfortable pace. The goal is to create a clear pause between work tasks.',
      },
      {
        title: 'Make the break practical',
        body: 'Check the weather, choose a safe route and use shade or sun protection when needed. If going outside is not suitable, walk indoors or stand near natural light instead.',
      },
    ],
    activitySafety: {
      comfortableRange:
        'Walk at a steady pace that feels comfortable and still lets you speak in full sentences. Slow down, shorten the route or take a seated rest when needed.',
      stopConditions: commonStopConditions,
      emergencyAdvice,
    },
    sources: [
      {
        publisher: 'Victorian Department of Health',
        title: 'Active living guidance',
        url: 'https://www.health.vic.gov.au/health-strategies/active-living-guidance',
      },
      {
        publisher: 'Australian Government Department of Health, Disability and Ageing',
        title: 'About physical activity',
        url: 'https://www.health.gov.au/topics/physical-activity/about-physical-activity',
      },
      ...activitySafetySources,
    ],
  },
]

export const guideById = Object.fromEntries(guides.map((guide) => [guide.id, guide]))

export const guideReviewDate = {
  dateTime: '2026-09-18',
  label: '18 September 2026',
}
