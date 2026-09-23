import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, CircleHelp, LoaderCircle, RefreshCw, Ruler, ScanLine, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
import { PostureIllustration } from '../Illustrations'
import type { DistanceRange } from '../posture'
import type { usePostureMonitor } from '../usePostureMonitor'

export function PosturePanel({ monitor, onHelp, onStartCamera, warningSound, audioError, onToggleSound, onTestSound, distanceRange }: {
  monitor: ReturnType<typeof usePostureMonitor>
  onHelp: () => void
  onStartCamera: () => void
  warningSound: boolean
  audioError: string | null
  onToggleSound: () => void
  onTestSound: () => void
  distanceRange: DistanceRange
}) {
  const [measuredDistance, setMeasuredDistance] = useState('')
  const distanceInput = useRef<HTMLInputElement>(null)
  useEffect(() => { if (monitor.stage === 'off') setMeasuredDistance('') }, [monitor.stage])
  const active = ['ready', 'calibrating', 'monitoring'].includes(monitor.stage)
  const loading = monitor.stage === 'starting'
  const calibrated = monitor.stage === 'monitoring'
  const adjusting = monitor.score !== null && monitor.score < 75
  const distanceWarning = monitor.distance !== null && monitor.distance.status !== 'comfortable'
  const label = loading ? 'Preparing' : !active ? 'Camera off' : monitor.tabPaused ? 'Camera paused' : !monitor.visible
    ? 'Not in view' : monitor.stage === 'calibrating' ? 'Calibrating' : !calibrated ? 'Ready to set up' : adjusting ? 'A gentle nudge' : distanceWarning ? 'Check your distance' : 'Looking balanced'
  const distanceValue = monitor.distance === null ? '--' : monitor.distance.centimeters === null
    ? `${Math.round(monitor.distance.ratio * 100)}%` : `~${Math.round(monitor.distance.centimeters)} cm`
  const distanceStatus = monitor.distance === null
    ? calibrated ? monitor.distanceReady ? 'Face the camera' : 'Face camera and recalibrate' : 'Calibrate to begin'
    : monitor.distance.status === 'close' ? 'Too close' : monitor.distance.status === 'far' ? 'Too far' : 'In range'

  return (
    <section className={`panel posture-panel ${adjusting ? 'posture-adjust' : ''}`} aria-labelledby="posture-heading">
      <div className="panel-heading">
        <h2 id="posture-heading"><ScanLine size={18} /> Posture companion</h2>
        <div className="posture-toolbar">
          <button className="icon-button subtle" aria-label={warningSound ? 'Mute posture warning sound' : 'Enable posture warning sound'} title={warningSound ? 'Warning sound on' : 'Warning sound muted'} onClick={onToggleSound}>{warningSound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
          <button className="icon-button subtle" aria-label="How posture monitoring works" onClick={onHelp}><CircleHelp size={17} /></button>
        </div>
      </div>
      <div className="posture-subheading">
        <span>A little awareness goes a long way.</span>
        <span className={`camera-status ${active ? adjusting || distanceWarning ? 'warning' : 'live' : ''}`}><i />{label}</span>
      </div>
      <div className={`camera-preview ${active ? 'is-live' : ''}`}>
        <div className="camera-feed">
          <video ref={monitor.videoRef} autoPlay muted playsInline aria-label="Live, mirrored camera preview" />
          <canvas ref={monitor.canvasRef} aria-hidden="true" />
        </div>
        {!active && (
          <div className="camera-placeholder">
            <PostureIllustration />
            <span>{loading ? <><LoaderCircle className="spin" size={14} /> {monitor.feedback}</> : 'A comfortable posture. A clearer mind.'}</span>
          </div>
        )}
        {active && (
          <>
            <span className="camera-private-badge"><ShieldCheck size={12} /> ONLY ON YOUR DEVICE</span>
            <button className="camera-stop" onClick={monitor.stop} aria-label="Turn off camera" title="Turn off camera"><CameraOff size={16} /></button>
            {(!monitor.visible || monitor.stage === 'calibrating') && (
              <div className="camera-guide">
                {monitor.tabPaused ? 'Your browser paused the camera. Return to this tab to resume.' : monitor.stage === 'calibrating' && monitor.visible ? `Hold comfortably still... ${monitor.progress}%` : 'Bring your head and shoulders into view'}
              </div>
            )}
          </>
        )}
      </div>
      <div className="monitor-readouts">
        <div className="posture-readout">
          <div className="alignment-row">
            <span>Live alignment</span>
            <strong>{monitor.score === null ? '--' : `${monitor.score}%`}</strong>
          </div>
          <div className={`alignment-track ${monitor.score === null ? 'empty' : ''}`} role={monitor.score === null ? 'img' : 'meter'}
            aria-label={monitor.score === null ? 'Alignment not yet measured' : 'Estimated alignment with your calibrated posture'}
            aria-valuemin={monitor.score === null ? undefined : 0} aria-valuemax={monitor.score === null ? undefined : 100}
            aria-valuenow={monitor.score ?? undefined} aria-valuetext={monitor.score === null ? undefined : `${monitor.score} percent`}>
            <div style={{ width: `${monitor.score ?? 0}%` }} />
          </div>
          <p className="readout-caption">Relative to your posture baseline</p>
        </div>
        <div className={`distance-readout ${distanceWarning ? 'distance-warning' : ''}`} role="group" aria-label="Estimated screen distance">
          <div className="distance-heading"><span>Screen distance</span><Ruler size={13} /></div>
          <div className="distance-value"><strong>{distanceValue}</strong><span className="distance-status" aria-live="polite">{distanceStatus}</span></div>
          <p className="readout-caption">{monitor.referenceCm === null ? 'Target: 80-125% of setup distance' : `Target: ${distanceRange.minCm}-${distanceRange.maxCm} cm (estimated)`}</p>
        </div>
      </div>
      {monitor.error ? (
        <p className="camera-error" role="alert">{monitor.error}</p>
      ) : (
        <p className="posture-message">{active ? monitor.tabPaused ? 'Camera frames are paused by your browser. Keep this tab open and visible to resume monitoring.' : distanceWarning && !adjusting ? monitor.distance?.feedback : !monitor.visible ? 'Use a front-facing camera with your head and both shoulders visible.' : monitor.feedback : 'Gentle sound alerts help you notice posture drift or an uncomfortable viewing distance.'}</p>
      )}
      {active && monitor.stage !== 'calibrating' && (
        <div className="distance-calibration">
          <label htmlFor="measured-distance">Measured starting distance <span>optional</span></label>
          <div className="distance-input-wrap"><input id="measured-distance" ref={distanceInput} type="number" min="20" max="200" step="1"
            value={measuredDistance} placeholder="e.g. 60" aria-label="Measured starting distance in centimeters"
            onChange={event => setMeasuredDistance(event.target.value)} /><span>cm</span></div>
          <p>Measure eyes to screen, with your camera nearby. Applied when you calibrate. Leave blank for a relative estimate.</p>
        </div>
      )}
      {!active && !loading ? (
        <button className="button camera-button full-width" onClick={onStartCamera}><Camera size={17} />{monitor.stage === 'error' ? 'Try camera again' : 'Enable camera'}</button>
      ) : loading ? (
        <button className="button camera-button full-width" onClick={monitor.stop}><CameraOff size={16} />Cancel camera setup</button>
      ) : (
        <button className="button camera-button full-width" disabled={!monitor.visible || monitor.stage === 'calibrating'} onClick={() => {
          if (distanceInput.current?.reportValidity() === false) return
          monitor.calibrate(measuredDistance === '' ? null : Number(measuredDistance))
        }}>
          {monitor.stage === 'calibrating' ? <LoaderCircle className="spin" size={16} /> : calibrated ? <RefreshCw size={16} /> : <ScanLine size={16} />}
          {monitor.stage === 'calibrating' ? `Finding your baseline... ${monitor.progress}%` : calibrated ? 'Recalibrate my posture' : 'Set my comfortable posture'}
        </button>
      )}
      <div className="warning-sound-row">
        <span>{warningSound ? <Volume2 size={12} /> : <VolumeX size={12} />}{warningSound ? 'Warning sound on' : 'Warning sound muted'}</span>
        <button className="text-button" onClick={onTestSound} disabled={!warningSound}>Test warning sound</button>
      </div>
      {audioError && warningSound && <p className="camera-error" role="alert">{audioError}</p>}
      <p className="camera-privacy"><ShieldCheck size={12} />On-device processing. No recordings. Just you.</p>
    </section>
  )
}
