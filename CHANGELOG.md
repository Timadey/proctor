## Changelogs
### v1.2.4
- Fix bugs in visual detection module
- Add event throttling to the audio detection module
- Add `TALKING_EPISODE` event to audio detection module
- Add support to upload a video file to demo instead of using the camera
- Add support to send `extracted_features` from event emission to an external endpoint for ingestion (in demo)
- Change `WINDOW_FOCUS_RESTORED` to `WINDOW_FOCUS_SWITCHED` and make it critical since blur event might not emit on all browsers
### v1.2.0
- Make significant change in making the package standalone
- Removed webrtc support, focus solely on extracting features and emitting events
### v0.1.0
- Initial release