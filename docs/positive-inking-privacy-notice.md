# Positive Inking — Privacy Notice

**Last updated: 4 September 2026**

---

## Who we are

Positive Inking ("we", "us") provides an AI-guided tool that helps you
turn a personal story into a written design brief ("Blueprint") that a
tattoo artist can use. This notice explains what happens to your
information when you use it.

**Contact:** Christos@positiveinking.org
**Business details:** Positive Inking is currently operated by Christos
Aravanis, trading as a sole trader. It is not yet a registered limited
company.

---

## What we collect

When you use Positive Inking, you may provide:

- **Your story** — text you type or dictate about the tattoo you want
  and why, which may include personal experiences, relationships, or
  significant life events.
- **Reference images** — photographs you choose to upload (for example,
  of an object, a place, or someone's handwriting).
- **Design choices** — your answers to structured questions (style,
  placement, treatment, and similar preferences).

We do not currently ask for your name, email address, or any account
information — there are no user accounts.

---

## How your information is used

Your story, images, and choices are sent to Anthropic's AI models to
generate design interpretations and, ultimately, your Blueprint. This
happens automatically as you move through the app; we do not manually
review your story unless you contact us for support.

We do not use your information for advertising, and we do not sell it.

---

## Where your information goes and how long it's kept

**On our own servers:** we do not store your story, images, or answers
in any database. Our server passes your input to Anthropic's API and
returns the result to your browser — nothing is written to a
persistent server-side store. Our server also does not log the
content of your story or images; only anonymous technical timing
information (how long a request took) is recorded.

**In your browser:** your progress is saved in your browser's local
storage so that you don't lose your work if your browser closes or
crashes. This stays on your device until you clear your browser's
site data yourself, or until it's overwritten by starting a new
session. We do not currently offer an in-app "delete my data" button —
you can remove this data at any time via your browser's own settings
(usually under Privacy / Clear browsing data / Site data).

**Reference images:** before an uploaded image is stored in your
browser, we automatically remove embedded metadata (including any
GPS location data your camera or phone may have attached to the
photo).

**At Anthropic (our AI provider):** Anthropic's standard retention
period for API content is **up to 30 days**, after which it is
automatically deleted from their systems, except where a longer
period applies (for example, if content is flagged as violating their
usage policies, or where required by law). Anthropic's terms state
that content submitted through their commercial API is not used to
train their models. This app authenticates using an API key issued
through Anthropic's Console/API Platform, which is governed by
Anthropic's Commercial Terms and Data Processing Addendum, confirmed
as of this notice's last update.

**Third-party tools:** we use Supabase (a database provider) to store
anonymous usage analytics — see "Anonymous usage analytics" below for
what that means in practice. We do not use any third-party analytics,
advertising, or error-tracking tool that would give another company
access to your story or images: Supabase never receives your story
text, your images, or anything that identifies you personally, and no
other third-party tool of any kind is used.

---

## Voice input

If you use the microphone/dictation feature, your browser's built-in
speech recognition is used to convert speech to text. By default, most
browsers (including Chrome) send this audio to their own servers (e.g.
Google's, for Chrome) to perform the conversion — this is a function
of your browser, not something Positive Inking controls or has access
to. We do not receive, store, or have access to any audio ourselves —
only the resulting text reaches us, exactly as if you had typed it. If
you'd prefer not to use voice input, you can type your story instead
at any time.

---

## Anonymous usage analytics

We track anonymous, aggregate information about how people use
Positive Inking — for example, how many people complete the journey,
which steps take longest, and where people tend to stop. This data is
not linked to your story, your images, or anything that identifies
you personally; it's used only to help us understand and improve the
tool. You cannot be identified from this information.

This data is stored using Supabase, a third-party database provider,
rather than purely on our own infrastructure. What's recorded is
structurally limited to step names, timestamps, and a random
non-persistent session identifier that resets every time you reload
the page — the system that validates each event before it's stored has
no field capable of carrying free text at all, so your story, your
images, or anything else you type or upload cannot reach this table
even accidentally. Using Supabase changes where this anonymous data is
stored; it does not change what is collected, and the same "you cannot
be identified from this information" guarantee applies exactly as
before.

---

## Sensitive information

Your story may naturally include sensitive details — for example,
about health, recovery, grief, relationships, or beliefs. You are
never required to include this kind of detail, and you can describe
your tattoo in more general terms if you prefer. If you do choose to
include sensitive information, it is processed only for the purpose
of creating your Blueprint, in the same way as the rest of your story,
as described above.

Before the story field, the app shows a short notice that your story
may include sensitive information of this kind and that including it
is entirely optional — a reminder shown at the point of entry, not a
consent step you have to act on.

---

## Photographs of other people

If you upload a photograph that includes another person (for example,
a photo of someone's handwriting, or an object connected to another
person), please only do so if you have that person's knowledge and
agreement, and please avoid uploading photographs of children's faces.
For handwriting or object references, a closely cropped image of just
the relevant detail is preferred over a full photograph.

At each point in the app where you can upload a reference photo, you
must check a confirmation ("I confirm I have the right to use this
image, and that any identifiable person in it knows and agrees to it
being used here") before the upload is accepted — this is an
explicit checkbox at the point of upload, not just notice text.

---

## Age

This service is intended for people aged 18 and over. Before you begin,
you'll be asked to confirm you're 18 or older via a simple checkbox —
we don't collect ID or any other proof of age.

---

## Your rights

If you are located in the UK or EU, you have rights under data
protection law, including the right to:

- **Access** the personal information we hold about you
- **Correct** inaccurate information
- **Request deletion** of your information
- **Object to** or **restrict** certain processing
- **Data portability** (receive your data in a portable format)
- **Withdraw consent** at any time, where processing is based on consent

Because we don't hold your story or images on our own servers, most of
what there is to access or delete lives in your own browser (see
"Where your information goes," above). For anything held by Anthropic
on our behalf, or for anonymous progress analytics (see below), contact
us at Christos@positiveinking.org and we'll help however we can. You
also have the right to complain to the Information Commissioner's
Office (ico.org.uk) if you believe your data has been mishandled.

---

## Changes to this notice

We may update this notice as the app changes. The date at the top
shows when it was last revised.

---

*This notice reflects a technical audit of the app's code as of
3 September 2026. If the app's behavior changes (for example, adding
user accounts, server-side storage, analytics, or a different AI
provider), this notice must be updated to match before publishing an
outdated version.*
