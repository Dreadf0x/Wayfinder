# Wayfinder Privacy Policy

**Last Updated: August 20, 2026**

## Introduction

Wayfinder is a Chrome extension designed to enhance the Canvas Learning Management System (LMS) with course progress tracking, student planning tools, and instructor progress-management features.

This Privacy Policy explains what information Wayfinder accesses, how that information is used and stored, and the steps taken to minimize the collection and exposure of user and student information.

## Our Privacy Approach

Wayfinder is designed around a **local-first architecture**.

Wayfinder does not operate an external application server or student database. Canvas information used by the extension is retrieved directly between the user's browser and their institution's Canvas LMS.

Wayfinder does not sell user information and does not use advertising or third-party analytics or tracking services.

## Information Accessed From Canvas

To provide its functionality, Wayfinder may access information available to the currently authenticated Canvas user, including:

* Course names and identifiers
* Modules and module items
* Assignment and quiz information
* Completion and submission status
* Grading status and scores when required for progress calculations
* Student names and Canvas user identifiers
* Enrollment and course activity information
* Canvas permissions and role information

The exact information available to Wayfinder depends on the user's existing Canvas account and permissions.

Wayfinder does not provide users with access to Canvas information they are not already authorized to access.

## Student Radar

For authorized instructors, Wayfinder's Student Radar feature may process Canvas student information to calculate and display course progress.

This may include:

* Student name
* Canvas student ID
* Enrollment information
* Course activity
* Assignment completion
* Submission status
* Grading status
* Progress calculations
* Instructor-defined course end dates

Student Radar information is retrieved from Canvas as needed. Wayfinder does not maintain an external database containing this information.

## Local Browser Storage

Wayfinder uses Chrome's Extension Storage API (`chrome.storage.local`) to store limited information required for extension functionality.

Locally stored information may include:

* Interface preferences
* Selected theme
* Collapsed/expanded interface state
* Course-specific settings
* Required-item selections
* Canvas course and assignment identifiers used for configuration
* Student Canvas IDs associated with instructor-defined course end dates
* Instructor-defined student end dates

This information is stored within Chrome's extension-specific local storage.

Wayfinder does **not** transmit this locally stored information to a Wayfinder-operated server.

Local extension storage should not be considered a secure credential vault. Wayfinder therefore does not intentionally use it to store Canvas passwords, session credentials, or long-lived authentication tokens.

## Canvas Course Configuration

Wayfinder may create, read, or update Wayfinder-specific configuration information within an authorized Canvas course.

Current versions may use a `wayfinder-course.json` configuration file and associated Canvas course resources to store instructor-defined Wayfinder course configuration.

This configuration may contain information such as:

* Canvas course ID
* Required module-item identifiers
* Assignment identifiers
* Module identifiers and names
* Required-item names and types
* Wayfinder course settings
* Configuration timestamps

This information is stored within the institution's Canvas environment and remains subject to the institution's Canvas access controls and policies.

Wayfinder does not use this configuration file to store student grades, assignment submissions, Canvas passwords, or authentication credentials.

## Authentication and Cookies

Wayfinder does **not create its own authentication cookies**.

Wayfinder uses the user's existing authenticated Canvas session when communicating with Canvas.

For certain authorized Canvas operations, Wayfinder may read Canvas's existing CSRF security token and include it with the corresponding Canvas request.

Wayfinder does not intentionally persist the Canvas CSRF token in Chrome extension storage or transmit it to a Wayfinder-operated server.

Wayfinder does not collect or store Canvas usernames or passwords.

## Information Wayfinder Does Not Sell or Monetize

Wayfinder does not sell, rent, or monetize user or student information.

Wayfinder does not use:

* Advertising networks
* Behavioral advertising
* Third-party analytics services
* Cross-site tracking
* User profiling for advertising
* Sale of student or instructor information

## External Data Transmission

Wayfinder's current architecture does not use a Wayfinder-operated cloud service for student analytics or progress processing.

Canvas-related requests are made directly between the user's browser and the authorized Canvas LMS environment.

Wayfinder does not intentionally transmit student grades, submissions, student records, Canvas credentials, or authentication tokens to third-party services.

## Chrome Permissions

Wayfinder requests Chrome permissions necessary for its functionality.

### Storage

The `storage` permission allows Wayfinder to save application preferences and limited course-specific configuration locally.

### Canvas Host Access

Wayfinder requires access to supported Canvas LMS pages so that it can retrieve authorized course information, calculate progress, display its interface, and perform instructor-authorized Wayfinder configuration operations.

Wayfinder is not designed to monitor general browsing activity outside supported Canvas environments.

## Data Retention and Removal

Information stored in Chrome extension storage remains locally available until it is removed by Wayfinder, cleared from Chrome, or the extension/application data is removed.

Wayfinder-specific information stored within Canvas remains subject to Canvas course access, retention, and institutional policies.

Removing the Wayfinder extension does not necessarily remove Wayfinder configuration resources previously created within Canvas.

## Data Security

Wayfinder is designed to minimize unnecessary data collection and storage.

Security measures and design choices include:

* Local-first application architecture
* No external Wayfinder student database
* No storage of Canvas passwords
* No intentional persistent storage of Canvas authentication tokens
* Limited Chrome extension permissions
* Direct communication with Canvas
* Use of the user's existing Canvas permissions
* No third-party advertising or analytics services

No software can guarantee absolute security. Wayfinder has not, as of the date of this policy, undergone formal third-party security certification or penetration testing.

## Educational and Student Data

Wayfinder is intended for use by authorized users of educational institutions using Canvas LMS.

Institutions and users remain responsible for using Wayfinder in accordance with their applicable institutional policies and legal requirements governing student information.

Wayfinder does not independently grant access to student information; access depends upon permissions already granted through Canvas.

## Changes to This Privacy Policy

This Privacy Policy may be updated as Wayfinder's features and architecture evolve.

Material changes will be reflected by updating the **Last Updated** date.

If future versions introduce external cloud storage, analytics, synchronization services, or materially different handling of student information, this policy will be updated accordingly.

## Contact and Project Information

Questions regarding Wayfinder or this Privacy Policy may be directed through the Wayfinder project repository.

**Wayfinder is an independent project and is not affiliated with, endorsed by, or sponsored by Instructure, Inc. Canvas is a trademark of Instructure, Inc.**

© 2026 Heber Hamilton. All rights reserved.
