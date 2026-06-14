# Alife Ministry Guide

## 1. Purpose Of This Document

This guide is written for:

- the church board or deacon board, to understand what this platform is for and how it supports ministry operations;
- website maintenance and content volunteers, to understand how to prepare, organize, and publish website content;
- ministry leaders, group leaders, and administrators, to understand the intended use of the main features.

Alife is not only an information website. It is a church operations platform that brings together member access, group management, page publishing, event workflows, notifications, sermon presentation, and routine ministry coordination in one system that works on both desktop and mobile devices.

## 2. What The Platform Is For

Alife is designed to bring scattered church processes into one consistent platform so that:

1. members and newcomers can access church information more easily;
2. leaders can manage groups and approvals with less manual coordination;
3. ministry content can be published in a structured and maintainable way;
4. events, enrollments, reviews, notifications, and sermon-related information can be handled more clearly;
5. website maintenance volunteers can support the church without needing to manage raw code or many disconnected tools.

## 3. Main Functions

### 3.1 Member Sign-In And Identity Management

- Members can sign in through LINE.
- The system stores member profile and group relationship data.
- Different users see different capabilities based on their role.
- Permissions are checked against current data so role changes take effect reliably.

For church leadership, this means the platform can support real ministry relationships, not just public announcements.

### 3.2 Group And Ministry Team Management

- The church can organize a main group and subgroups.
- Members can request access to groups.
- Leaders and co-leaders can approve, reject, assign roles, or remove members.
- Daily reading pages and management pages are separated, which keeps the experience clearer for users.

This is well suited for small groups, ministry teams, classes, and other church-based community structures.

### 3.3 Page And Content Publishing

- The platform supports both global pages and group-specific pages.
- Pages support bilingual title and summary fields in Chinese and English.
- Content is organized in sections instead of editing raw page code.
- Each page can be assigned one of three visibility states:
  - `Draft`: internal draft, not ready for general readers.
  - `Group`: visible to members of the relevant group.
  - `Public`: visible to the whole church or public visitors.

This allows the system to serve both as an internal ministry information space and as a public-facing church website.

### 3.4 Events And Enrollment Workflows

- Groups can create and manage event information.
- Members can submit event enrollments.
- The system supports conversation-based AI assistance for event planning, enrollment, and review drafts.
- Final enrollments and reviews are still submitted through normal backend APIs, which keeps human review and correction in the workflow.

This gives the church room to support retreats, courses, workshops, service signups, and other ministry events with a more structured process.

### 3.5 Notifications And Replies

- The platform includes notification messages for member-facing actions and follow-up.
- Members can mark notifications as read.
- Some workflows can collect structured replies instead of relying only on scattered chat messages.

This is useful for approval, follow-up, and light administrative coordination where the church needs a clearer record of what happened.

### 3.6 Sermons And Teaching Content

- The platform can display a sermon list.
- Administrators can synchronize sermon data.
- This is useful for Sunday messages, teaching series, and discipleship resources.

### 3.7 Mobile-Friendly Access

- The frontend is designed to work well on mobile devices.
- Members can browse pages, read updates, and interact with church content from phones or desktops.
- This makes the platform practical for weekly ministry communication and ongoing engagement.

## 4. Recommended Ministry Responsibilities

### 4.1 Deacon Board Or Core Church Administration

Recommended responsibilities:

- decide what kinds of content the platform should carry first;
- decide which content should be public and which content should remain group-only;
- assign content review responsibility for official pages;
- define who owns ministry, administrative, and technical oversight.

### 4.2 Website Maintenance And Content Volunteers

Recommended responsibilities:

- create and maintain pages;
- organize text and images for publishing;
- keep page structure, links, and ordering clear;
- help move approved content from draft to public or group-visible status.

### 4.3 Group Leaders And Ministry Leaders

Recommended responsibilities:

- manage members within their assigned group;
- maintain group pages and event information;
- review join requests and event-related workflows.

## 5. How To Prepare And Publish Website Content

This section is the practical content manual for website volunteers. The goal is not software development. The goal is to prepare church content in a form that is clear, structured, and easy to maintain.

### 5.1 Decide What Type Of Page You Are Creating

Before writing, decide whether the page is:

- a global church page, such as church introduction, service times, course overview, giving information, or newcomer guidance; or
- a group page, such as a small group introduction, ministry-specific information, internal training notes, or group-only announcements.

If the content is intended for all readers, it usually belongs on a public page.
If the content is only for a ministry team or group, it usually belongs on a group page.

### 5.2 Decide The Visibility Before Publishing

Every page should be reviewed with the correct visibility in mind:

- `Draft`: use while the content is still being prepared or reviewed.
- `Group`: use for internal ministry or group content.
- `Public`: use for official church-facing or visitor-facing content.

A recommended workflow is:

1. save the page as `Draft`;
2. let the responsible reviewer check the content;
3. publish it as `Group` or `Public` when approved.

### 5.3 Prepare Bilingual Titles And Summaries

The system supports both Chinese and English title and summary fields. Even if the church mainly publishes in Chinese today, it is wise to prepare with bilingual structure in mind because it:

- supports bilingual ministry in the future;
- helps international visitors understand the purpose of a page;
- makes future English expansion easier.

Recommended writing approach:

- Chinese title: clear and ministry-appropriate.
- English title: concise and natural, not necessarily word-for-word.
- Chinese summary: 1 to 3 sentences explaining the page purpose.
- English summary: keep the same meaning, even if phrased differently.

### 5.4 Build Pages In Clear Sections

Instead of placing one large block of text on a page, organize the content into sections. A good page often includes:

1. an opening section with title, short introduction, and possibly a main image;
2. a core explanation section describing purpose, audience, requirements, or ministry details;
3. an action section with time, place, contact, registration steps, or links;
4. a related resources section with connected pages, sermons, courses, or group links.

This makes the page easier to read and easier to update later.

### 5.5 Content Writing Principles

Use these principles when preparing content:

- one page should focus on one topic;
- state the main point early;
- clearly include time, place, audience, and next steps when applicable;
- avoid mixing long-term reference content with short-lived announcements unless they are clearly separated;
- use images that are clear, appropriate, and consistent with church context;
- always test external links and videos before publishing.

### 5.6 Suggested Page Templates For Church Use

#### Church Introduction Page

- who we are;
- service time and location;
- ministry vision or core values;
- what a first-time visitor should know;
- contact information.

#### Small Group Or Ministry Page

- group or ministry name;
- who it is for;
- meeting time and format;
- key leaders or contact people;
- how to join.

#### Course Or Event Page

- event or course name;
- intended audience;
- date, time, and place;
- registration instructions;
- things participants should know;
- follow-up contact information.

#### Sermon Or Teaching Landing Page

- current series;
- latest sermon;
- archive access;
- related devotional or teaching resources.

### 5.7 Content Review Checklist

Before publishing, check at least these items:

- is the title clear;
- is the summary understandable for a first-time visitor;
- are images appropriate and presentable;
- do all links work correctly;
- are time and location details up to date;
- is the visibility set correctly;
- if English content is included, is it natural and understandable.

### 5.8 Suggested Update Rhythm

It is helpful to establish a regular content review rhythm:

- weekly: homepage, sermons, near-term events;
- monthly: service information, course pages, ministry pages;
- quarterly: church profile, staff or ministry information, common guidance pages;
- before and after major events: add event pages, update registration instructions, and publish recap content.

## 6. Recommendations For The Deacon Board

From a leadership and governance perspective, Alife is best understood as a unified church content and group collaboration platform, not only a static website. It is useful to decide early:

1. which pages must stay public and be updated regularly;
2. which groups or ministries should start using the system first;
3. who reviews official content, who maintains the site, and who updates ministry information;
4. which materials are public and which are only for approved members.

If those responsibilities are defined early, the system will be much easier to sustain over time.

## 7. Recommendations For Website Maintenance Volunteers

1. Start with a small set of stable core pages rather than trying to build everything at once.
2. Prioritize information people ask for most often, such as service times, church introduction, sermon access, courses, and event registration.
3. Use `Draft` first for all new content.
4. Keep an internal content list with page owner, last updated date, and next review date.
5. Double-check page visibility whenever a page includes member, group, or internal ministry information.

## 8. Conclusion

Alife is well suited to support church communication, group life, and content publishing in one platform. Its value is not only that information can be displayed online, but that members, pages, events, and sermons can follow a more consistent ministry workflow.

For church leadership, it provides a practical coordination platform.
For content and website volunteers, it provides a section-based content tool that is easier to maintain over time.

If the church uses a simple pattern of draft, review, publish, and scheduled updates, the platform can remain much more manageable than scattered pages maintained without a shared process.
