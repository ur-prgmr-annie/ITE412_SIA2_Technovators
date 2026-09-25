Project Overview

1. System Objectives

ANIMIS: An Integrated Animal Health Services Support System aims to develop a centralized digital system for the Municipal Agriculture Office of Naujan, Oriental Mindoro.

The system aims to:

* Reduce the average data consolidation and reporting turnaround time.
* Decrease the average record retrieval time.
* Support the animal health services of the Municipal Agriculture Office of Naujan.
* Improve the management of animal profiling, health services, breeding records, disease monitoring, and inventory information.
* Support IoT-based cold chain monitoring for vaccines.
* Provide GIS mapping for livestock and disease data.
* Support mobile accessibility for field officers.

The system is designed to address manual, paper-based, and spreadsheet-driven processes that may result in reporting delays, encoding errors, and difficulty retrieving historical records.

2. Proposed Scope

The ANIMIS project will focus on the digitization and integration of animal health service processes within the Municipal Agriculture Office of Naujan, Oriental Mindoro.

Modules and Systems to Be Integrated

1. Animal and Owner Registration
* Animal registration
* Owner and farm/household information
* Animal breed, category, and location
2. Animal Health Services Management
* Vaccination records
* Deworming records
* Treatment records
* Other animal health services
* Scheduling and alerts
3. Animal Breeding Records Management
* Estrus schedules
* Artificial insemination records
* Pregnancy checks
* Breeding performance tracking
4. Disease Surveillance and GIS Mapping
* Disease incident recording
* ASF and Bird Flu case reporting
* GIS mapping for disease hotspots
* Barangay-based monitoring
5. Vaccine and Veterinary Supply Inventory
* Stock level monitoring
* Batch number recording
* Expiry date monitoring
* Supply usage tracking
6. IoT-Based Cold Chain Monitoring
* Real-time temperature monitoring
* Humidity monitoring
* Vaccine storage alerts
* Integration with IoT-based monitoring devices
7. Reports and Analytics
* Animal health service reports
* Breeding outcome reports
* Disease trend reports
* Inventory reports
* Reports by barangay and program
8. User Authentication and Access Control
* Administrator access
* Field Officer access
* Inventory Officer access
* Role-based access control
9. Centralized Dashboard
* Registered animals
* Health services
* Breeding activities
* Disease reports
* Vaccine inventory
* IoT cold chain readings

In-Scope Features for the Initial Project

* System repository and documentation
* System integration planning
* Integration of software modules
* Data exchange between system components
* IoT and GIS integration planning
* Authentication and role-based access control
* Data reporting and monitoring features

Out-of-Scope Features

* Operations outside the Municipal Agriculture Office of Naujan
* Human healthcare services
* Agricultural services unrelated to the defined ANIMIS scope
* Veterinary facilities outside the specified project coverage
3. Stakeholders
4. Municipal Agriculture Office of Naujan (MAO Naujan)

The primary organization that will use the system to manage animal health services, consolidate reports, and support planning and monitoring activities.

2. Livestock Owners and the Community

Beneficiaries of animal health services and livestock monitoring activities. Their animal and owner information may be managed through the system.

3. Barangay Staff

Personnel involved in barangay-based monitoring, service coverage, and reporting of livestock and disease-related information.

4. Future Researchers

Potential users of the documented project information for future research, improvements, and system development.

5. System Administrators, Field Officers, and Inventory Officers

Primary system users identified in the stakeholder interview. Administrators and inventory officers use desktops or laptops for management and reporting, while field officers use mobile devices for on-site tasks.

4. Tools \& Technologies

Languages and Frameworks

* To be finalized based on the team's actual implementation.
* Technologies for web and mobile application development.
* Technologies for IoT device programming and data collection.

Integration Approach

* IoT-based cold chain monitoring integration
* GIS mapping integration
* Data synchronization between mobile devices and cloud backend
* Integration of system modules for centralized data management
* REST APIs or other integration methods, if applicable to the final implementation

Repositories and Services

* GitHub — Source code management and collaboration
* Git — Version control
* Firebase services — Cloud backend and real-time data synchronization, as specified in the system requirements
* MS Teams / Team Group Chat — Team communication

Testing Tools

* Functional testing for system modules
* Integration testing for communication between system components
* Validation of collected IoT data
* Testing of authentication, access control, and data synchronization

System Limitations

The ANIMIS system is limited to the specific operations of the Municipal Agriculture Office of Naujan, Oriental Mindoro. It does not cover human healthcare or other agricultural services outside the approved scope.







\## High-Level System Overview



\### Introduction

The ANIMIS: An Integrated Animal Health Services Support System is a web and mobile-based platform designed to improve the operations of the Municipal Agriculture Office of Naujan. It enables staff to register animals and farms, document health services, monitor breeding and vaccination schedules, track disease incidents, and manage vaccine inventory. It integrates IoT-based cold chain monitoring for real-time vaccine storage updates and GIS mapping for visualizing service coverage and disease hotspots.



The primary users are Administrators, Field Officers, and Inventory Officers. Field Officers use mobile devices for on-site tasks with offline capability, while Administrators and Inventory Officers use desktops or laptops for management and reporting. The system aims to reduce reporting turnaround time, decrease record retrieval time, enhance data accuracy, and support evidence-based decision-making for livestock management and disease prevention in Naujan.



\### Major Modules/Subsystems



1\. \*Animal \& Farm Registration Module\*

&#x20;  - Centralized profiling of animals and owners per barangay

&#x20;  - Tracks coverage and maintains comprehensive livestock records

&#x20;  - Supports animal registration, owner information, and farm/household data



2\. \*Health Services Monitoring Module\*

&#x20;  - Records vaccinations, deworming, treatments, and other health services

&#x20;  - Includes scheduling and alerts for pending or missed activities

&#x20;  - Tracks disease occurrence, vaccination history, and treatment progress



3\. \*Breeding Management Module\*

&#x20;  - Manages estrus schedules, artificial insemination, pregnancy checks

&#x20;  - Tracks breeding performance and outcomes

&#x20;  - Documents breeding cycles, parentage, and health checks



4\. \*Disease Surveillance Module\*

&#x20;  - Structured reporting for ASF, Bird Flu, and other livestock diseases

&#x20;  - Monitors disease incidence, outbreaks, and patterns

&#x20;  - Supports early detection, prevention, and control strategies



5\. \*Vaccine \& Supply Inventory Management Module\*

&#x20;  - Tracks stock levels, batch numbers, and expiry dates

&#x20;  - Integrated with IoT-based cold chain monitoring

&#x20;  - Provides real-time temperature and humidity monitoring with alerts



6\. \*GIS Mapping Module\*

&#x20;  - Visualizes geographic distribution of livestock and disease incidents

&#x20;  - Identifies barangay-level hotspots

&#x20;  - Guides targeted interventions and resource allocation



7\. \*Reporting \& Analytics Module\*

&#x20;  - Generates daily, monthly, and annual summaries

&#x20;  - Provides charts and visual reports for decision-making

&#x20;  - Supports evidence-based planning and strategic interventions



8\. \*Mobile Application\*

&#x20;  - Allows field staff to record data on-site

&#x20;  - Offline capability with automatic synchronization when connected

&#x20;  - Supports GIS mapping and real-time data entry



\### External Systems/Interfaces



| External System | Description |

|---|---|

| \*Firebase Cloud Firestore\* | NoSQL database for structured data (users, animals, inventory, reports) |

| \*Firebase Realtime Database\* | Handles real-time IoT sensor data for cold chain monitoring |

| \*Firebase Authentication\* | Secures user access with encrypted credentials |

| \*Firebase Cloud Functions\* | Backend automation for notifications and alerts |

| \*Firebase Cloud Messaging\* | Push notifications for alerts and reminders |

| \*Google Maps API\* | GIS mapping for service coverage and disease hotspots |

| \*IoT Sensors (ESP32, DHT22, DS18B20)\* | Cold chain monitoring devices for vaccine storage |

| \*SMS/Email Gateway\* | Optional notifications for alerts and reports |



\### Data Flow Summary



The ANIMIS system follows a layered client-cloud architecture where data flows from external entities through the system processes to data stores and back to users. Staff and Admin access the system through web or mobile applications, authenticating via Firebase Authentication. Once authenticated, Staff can register animals and farms, record health services, manage breeding data, and report disease cases. These inputs are processed and stored in Firebase Cloud Firestore collections (animals, routine\_services, breeding\_records, disease\_reports). IoT sensors continuously transmit temperature and humidity data to the Firebase Realtime Database, which triggers alerts when conditions exceed safe thresholds. Admin users manage user access, system settings, and inventory through the admin dashboard. All processed data flows into the Reporting \& Analytics module, which generates dashboards, GIS maps, and exportable reports for decision-making. The system supports offline data entry through Progressive Web App (PWA) caching, with automatic synchronization once connectivity is restored, ensuring data consistency and integrity across all modules.



