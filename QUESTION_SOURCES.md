# Question bank / previous-year coverage

The app loads all questions from `./questions.json`.

The current bundled bank contains the questions already present in the project plus the newly supplied 100-question bank. The app supports year-wise filtering for any year represented in the JSON.

Public web research confirms that Bangladesh medical admission past papers are available for many sessions, including 2015-2016 through 2024-2025, and that some public question-bank sites list even earlier years. The code therefore supports arbitrary additional years without any HTML/JavaScript changes.

For a production app, add only question content you have permission to republish. Do not bulk-copy third-party question banks into the repository without permission. Add licensed/owned questions directly to `questions.json`.

Research references:
- AdmissionTestBD: https://admissiontestbd.com/medical-admission/past-questions
- SATT Academy: https://sattacademy.com/admission?categories%5B%5D=122
- DGHS notice archive: https://dghs.gov.bd/

Replace or extend `questions.json` to add more years.
