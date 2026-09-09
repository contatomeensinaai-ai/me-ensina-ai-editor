import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisualMaskSvgDataUrl } from './visualEffects.js';
import * as geometry from './supportingImages.js';

test('solid overlay masks produce alpha geometry, without requiring feather or inversion', () => {
  for (const type of ['circle','rectangle','rounded']) {
    const svg = getVisualMaskSvgDataUrl({type,feather:0,inverted:false},{width:1080,height:768});
    assert.ok(svg.startsWith('data:image/svg+xml,'), type);
  }
});
test('composition regions constrain masks to the same split viewport used by export', () => {
  assert.equal(typeof geometry.getVisualCompositionRegion, 'function');
  for (const topRatio of [.2,.4,.5,.65]) {
    const frame={width:1080,height:1920};
    const main={supportingLayout:{version:1,windows:[{start:2,end:4,topRatio}]}};
    assert.deepEqual(geometry.getVisualCompositionRegion(main,frame,3),{x:0,y:1920*topRatio,width:1080,height:1920*(1-topRatio)});
    assert.deepEqual(geometry.getVisualCompositionRegion(main,frame,4),{x:0,y:0,...frame});
    assert.deepEqual(geometry.getVisualCompositionRegion({supportingLayout:{role:'image',topRatio}},frame,3),{x:0,y:0,width:1080,height:1920*topRatio});
  }
});
