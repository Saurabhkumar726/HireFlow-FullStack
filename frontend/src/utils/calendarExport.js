/**
 * Generates and downloads a standard RFC 5545 iCalendar (.ics) file
 * compatible with Google Calendar, Apple Calendar, and Microsoft Outlook.
 */
export function downloadInterviewIcs({
    id,
    title,
    company,
    scheduledAt,
    meetingLink,
    interviewType = 'Interview',
    durationMinutes = 45,
}) {
    if (!scheduledAt) return

    const startDate = new Date(scheduledAt)
    if (Number.isNaN(startDate.getTime())) return

    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)

    function formatIcsDate(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    const startFormatted = formatIcsDate(startDate)
    const endFormatted = formatIcsDate(endDate)
    const nowFormatted = formatIcsDate(new Date())
    const uid = `hireflow-interview-${id || Date.now()}@hireflow.app`

    const summary = `${interviewType}: ${title || 'Job Interview'} with ${company || 'HireFlow Employer'}`
    const description = `HireFlow Interview Details:\\nType: ${interviewType}\\nRole: ${title || 'Position'}\\nCompany: ${company || 'Employer'}${meetingLink ? `\\nMeeting Link: ${meetingLink}` : ''}\\n\\nGood luck with your interview!`
    const location = meetingLink || 'Remote / Online Video Conference'

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//HireFlow//Career Platform v2.0//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${nowFormatted}`,
        `DTSTART:${startFormatted}`,
        `DTEND:${endFormatted}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        meetingLink ? `URL:${meetingLink}` : '',
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Interview Reminder: Starting in 15 minutes',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ]
        .filter(Boolean)
        .join('\r\n')

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.setAttribute('download', `hireflow-interview-${id || 'session'}.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(link.href)
}
