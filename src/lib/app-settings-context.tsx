"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface AppSettingsContextValue {
  meetupName: string;
  setMeetupName: (name: string) => void;
  meetupDescription: string;
  meetupWebsite: string;
  meetupPastEventLink: string;
  venueRequestCc: string;
  setVenueRequestCc: (emails: string) => void;
  minVolunteerTasks: number;
  setMinVolunteerTasks: (n: number) => void;
  minEventDuration: number;
  setMinEventDuration: (hours: number) => void;
  logoLight: string | null;
  setLogoLight: (url: string | null) => void;
  logoDark: string | null;
  setLogoDark: (url: string | null) => void;
  loading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  meetupName: "Meetup Manager",
  setMeetupName: () => {},
  meetupDescription: "",
  meetupWebsite: "",
  meetupPastEventLink: "",
  venueRequestCc: "",
  setVenueRequestCc: () => {},
  minVolunteerTasks: 7,
  setMinVolunteerTasks: () => {},
  minEventDuration: 4,
  setMinEventDuration: () => {},
  logoLight: null,
  setLogoLight: () => {},
  logoDark: null,
  setLogoDark: () => {},
  loading: true,
});

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [meetupName, setMeetupName] = useState("Meetup Manager");
  const [meetupDescription, setMeetupDescription] = useState("");
  const [meetupWebsite, setMeetupWebsite] = useState("");
  const [meetupPastEventLink, setMeetupPastEventLink] = useState("");
  const [venueRequestCc, setVenueRequestCc] = useState("");
  const [minVolunteerTasks, setMinVolunteerTasks] = useState(7);
  const [minEventDuration, setMinEventDuration] = useState(4);
  const [logoLight, setLogoLight] = useState<string | null>(null);
  const [logoDark, setLogoDark] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string>) => {
        if ("meetup_name" in data) {
          setMeetupName(data.meetup_name || "Meetup Manager");
        }
        if ("meetup_description" in data) {
          setMeetupDescription(data.meetup_description || "");
        }
        if ("meetup_website" in data) {
          setMeetupWebsite(data.meetup_website || "");
        }
        if ("meetup_past_event_link" in data) {
          setMeetupPastEventLink(data.meetup_past_event_link || "");
        }
        if ("venue_request_cc" in data) {
          setVenueRequestCc(data.venue_request_cc || "");
        }
        if (data.min_volunteer_tasks) {
          const parsed = parseInt(data.min_volunteer_tasks, 10);
          if (!isNaN(parsed) && parsed > 0) setMinVolunteerTasks(parsed);
        }
        if (data.min_event_duration) {
          const parsed = parseInt(data.min_event_duration, 10);
          if (!isNaN(parsed) && parsed > 0) setMinEventDuration(parsed);
        }
        if (data.logo_light) setLogoLight(data.logo_light);
        if (data.logo_dark) setLogoDark(data.logo_dark);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateMeetupName = useCallback((name: string) => {
    setMeetupName(name);
  }, []);

  const updateMinVolunteerTasks = useCallback((n: number) => {
    setMinVolunteerTasks(n);
  }, []);

  const updateVenueRequestCc = useCallback((emails: string) => {
    setVenueRequestCc(emails);
  }, []);

  const updateMinEventDuration = useCallback((hours: number) => {
    setMinEventDuration(hours);
  }, []);

  const updateLogoLight = useCallback((url: string | null) => {
    setLogoLight(url);
  }, []);

  const updateLogoDark = useCallback((url: string | null) => {
    setLogoDark(url);
  }, []);

  return (
    <AppSettingsContext.Provider
      value={{
        meetupName,
        setMeetupName: updateMeetupName,
        meetupDescription,
        meetupWebsite,
        meetupPastEventLink,
        venueRequestCc,
        setVenueRequestCc: updateVenueRequestCc,
        minVolunteerTasks,
        setMinVolunteerTasks: updateMinVolunteerTasks,
        minEventDuration,
        setMinEventDuration: updateMinEventDuration,
        logoLight,
        setLogoLight: updateLogoLight,
        logoDark,
        setLogoDark: updateLogoDark,
        loading,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
