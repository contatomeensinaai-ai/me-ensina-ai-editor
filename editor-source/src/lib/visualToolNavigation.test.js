import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditorCommandActions} from './editorCommandActions.js';
function run(extra={},tool='filters') {
 const state={};const d={visualSegments:[],visualOverlaySegments:[],selectedTrack:'caption',isCompactViewport:true,...extra};
 for(const key of ['ActiveTool','AvatarPanelOpen','SelectedTrack','SelectedVisualSegmentId','SelectedVisualOverlayId','MobilePanelOrigin','MobileInspectorSection','MobilePanel'])d[`set${key}`]=v=>state[key]=v;
 d.notify=v=>state.notice=v;d.t=k=>k;
 createEditorCommandActions(d).selectTool(tool);return state;
}
test('filter shortcut selects the only visual and opens the inspector from caption mode',()=>{
 const state=run({visualSegments:[{id:'only'}]});assert.equal(state.SelectedVisualSegmentId,'only');assert.equal(state.SelectedTrack,'image');assert.equal(state.MobileInspectorSection,'filters');assert.equal(state.MobilePanel,'inspector');
});
test('mask shortcut preserves selected overlay instead of applying to base video',()=>{
 const state=run({selectedTrack:'overlay',selectedVisualOverlayId:'support',visualSegments:[{id:'base'}],visualOverlaySegments:[{id:'support'}]},'mask');assert.equal(state.SelectedVisualOverlayId,'support');assert.equal(state.SelectedTrack,'overlay');assert.equal(state.MobilePanelOrigin,'overlay-clip');
});
test('multiple unselected visuals are not guessed and empty project receives import guidance',()=>{
 const multi=run({visualSegments:[{id:'one'},{id:'two'}]});assert.equal(multi.SelectedVisualSegmentId,undefined);assert.equal(multi.notice,'visualShortcutSelect');
 assert.equal(run().notice,'visualShortcutImport');
});
