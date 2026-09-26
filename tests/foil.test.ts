import { describe, expect, it } from "vitest";
import { foilRoots } from "../lib/portrait/foil";
import type { PortraitMetaV2 } from "../lib/portrait/normalize";
const meta = { srcW: 100, srcH: 100, faceBox: { x: 40, y: 10, w: 20, h: 20 }, tx: 0, ty: 0, scale: 1/150 } as PortraitMetaV2;
function silhouette(left: number, right: number) {
 const pixels=new Uint8ClampedArray(100*100*4);
 for(let y=0;y<100;y++) for(let x=left;x<=right;x++) pixels[(y*100+x)*4+3]=255;
 return pixels;
}
describe("foil attachment to different silhouettes",()=>{
 it("moves both roots outward for a wider player",()=>{
  const narrow=foilRoots(silhouette(35,65),100,100,meta)!;
  const wide=foilRoots(silhouette(20,80),100,100,meta)!;
  expect(narrow.left).toBeCloseTo(350); expect(narrow.right).toBeCloseTo(650);
  expect(wide.left).toBeCloseTo(200); expect(wide.right).toBeCloseTo(800);
  expect(wide.y).toBeCloseTo(narrow.y);
 });
 it("follows asymmetric and translated portraits",()=>{
  const roots=foilRoots(silhouette(25,70),100,100,{...meta,tx:.05,ty:.1})!;
  expect(roots.left).toBeCloseTo(300); expect(roots.right).toBeCloseTo(750);
  expect(roots.y).toBeCloseTo(470);
 });
 it("does not invent edges for transparent rows",()=>{
  expect(foilRoots(new Uint8ClampedArray(40000),100,100,meta)).toBeNull();
 });
});
