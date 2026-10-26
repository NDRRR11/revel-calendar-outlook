function getPref(name, defaultVal) {
    if (typeof gadgets !== 'undefined' && gadgets.prefs) {
        var val = gadgets.prefs.getString(name);
        if (val) return val;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || defaultVal;
}

async function loadCalendar() {
    let icsUrl = getPref('icsUrl', '');
    const mode = getPref('mode', 'weekly');
    const maxDays = parseInt(getPref('maxDays', '7'));

    document.documentElement.style.setProperty('--bg-color', getPref('bgColor', 'rgba(0,0,0,0.5)'));
    document.documentElement.style.setProperty('--text-color', getPref('textColor', '#ffffff'));
    document.documentElement.style.setProperty('--font-size', getPref('fontSize', '16') + 'px');

    const header = document.getElementById('calendar-header');
    const container = document.getElementById('calendar-events');

    if (!icsUrl) {
        header.textContent = "Configuration Required";
        container.innerHTML = '<div class="event-item">Please enter your Outlook ICS URL in the gadget properties.</div>';
        return;
    }

    // Convert Outlook webcal:// to https://
    if (icsUrl.startsWith('webcal://')) {
        icsUrl = 'https://' + icsUrl.substring(9);
    }

    header.textContent = "Fetching calendar...";

    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(icsUrl)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.text();

        if (!data || data.includes('<!DOCTYPE html>')) {
            throw new Error("Invalid ICS feed or URL blocked by redirect/auth.");
        }

        const jcalData = ICAL.parse(data);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        const now = new Date();
        const events = [];

        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            if (event.startDate) {
                const startDate = event.startDate.toJSDate();
                if (startDate >= now) {
                    events.push({
                        title: event.summary || 'Untitled Meeting',
                        startDate: startDate,
                        timeString: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        dateString: startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
                    });
                }
            }
        });

        events.sort((a, b) => a.startDate - b.startDate);
        render(events, mode, maxDays);
    } catch (err) {
        console.error(err);
        header.textContent = "Error Loading Feed";
        container.innerHTML = `<div class="event-item" style="color: #ff6b6b;">${err.message}</div>`;
    }
}

function render(events, mode, maxDays) {
    const container = document.getElementById('calendar-events');
    const header = document.getElementById('calendar-header');
    container.innerHTML = '';

    if (events.length === 0) {
        header.textContent = "Schedule";
        container.innerHTML = '<div class="event-item">No upcoming meetings found.</div>';
        return;
    }

    if (mode === 'daily') {
        header.textContent = "Today's Featured Meeting";
        const ev = events[0];
        container.innerHTML = `
            <div class="event-item daily-view">
                <div class="event-name">${ev.title}</div>
                <div class="event-time">${ev.timeString}</div>
                <div class="event-date">${ev.dateString}</div>
            </div>
        `;
    } else {
        header.textContent = "Upcoming Schedule";
        const filtered = events.filter(ev => (ev.startDate - new Date()) / (1000 * 60 * 60 * 24) <= maxDays);
        
        if (filtered.length === 0) {
            container.innerHTML = '<div class="event-item">No meetings in the selected range.</div>';
            return;
        }

        filtered.forEach(ev => {
            const div = document.createElement('div');
            div.className = 'event-item weekly-view';
            div.innerHTML = `
                <div class="event-date">${ev.dateString}</div>
                <div class="event-time">${ev.timeString}</div>
                <div class="event-name">${ev.title}</div>
            `;
            container.appendChild(div);
        });
    }
}

loadCalendar();
setInterval(loadCalendar, 15 * 60 * 1000);
