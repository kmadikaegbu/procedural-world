import { MAX_TREES, SCATTER_SLIDERS, emptyMask } from './scatter'
import { IVY_SLIDERS } from './ivy'
import { LOD_COLORS } from './lod'
import { TREE_LOOKS } from './materials'
import { SEASON_NAMES } from './seasons'
import { SPECIES_NAMES, type SpeciesName } from './species'
import { TREE_SLIDERS, paramsFromSpecies } from './treeSet'
import type { TreeControls } from './useTreeControls'

/**
 * UI PANEL — everything on the map's Props tab: how many trees and where
 * (scatter + planting mask), what they look like (species + L-system sliders),
 * look & season, ivy, and level of detail. State lives in useTreeControls.
 */
export function TreePanel({
  c,
  painting,
}: {
  c: TreeControls
  /** The planting-mask brush is live (Props tab open and Paint/Erase picked). */
  painting: boolean
}) {
  const {
    showTrees, setShowTrees,
    treeCount, setTreeCount,
    setScatterSeed,
    tree, setTree, treeMixed, treeSet,
    scatter, setScatter,
    mask, setMask, maskTool, setMaskTool, maskRadius, setMaskRadius,
    placed,
    look, setLook, season, setSeason,
    ivy, setIvy,
    lod, setLod, setLodThreshold, lodReadout,
  } = c

  return (
    <>
              <div className="panel-title">Trees</div>

              <label
                className="row"
                title="Show or hide the forest entirely."
              >
                <span>Show trees</span>
                <input
                  type="checkbox"
                  checked={showTrees}
                  onChange={(e) => setShowTrees(e.target.checked)}
                />
              </label>

              <label
                className="row"
                title="How many trees are drawn, out of every spot on grassy land across the city that fits the scatter rules below. Most are placed around Roosevelt Island, the rest more sparsely elsewhere. Cheap to drag — it only changes how many of the already-computed positions are shown."
              >
                <span>Count</span>
                <input
                  type="range"
                  min={0}
                  max={MAX_TREES}
                  step={250}
                  value={treeCount}
                  disabled={!showTrees}
                  onChange={(e) => setTreeCount(Number(e.target.value))}
                />
                <em>{treeCount}</em>
              </label>

              <div className="panel-actions">
                <button
                  disabled={!showTrees}
                  onClick={() => setScatterSeed((s) => s + 1)}
                  title="Re-roll where trees can grow, without changing the terrain itself."
                >
                  Replant
                </button>
              </div>

              <div className="panel-title">Scatter</div>

              {SCATTER_SLIDERS.map((sl) => (
                <label key={sl.key} className="row" title={sl.title}>
                  <span>{sl.label}</span>
                  <input
                    type="range"
                    min={sl.min}
                    max={sl.max}
                    step={sl.step}
                    value={scatter[sl.key]}
                    disabled={!showTrees}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setScatter((c) => {
                        const next = { ...c, [sl.key]: v }
                        // keep the scale range the right way round
                        if (sl.key === 'scaleMin') next.scaleMax = Math.max(c.scaleMax, v)
                        if (sl.key === 'scaleMax') next.scaleMin = Math.min(c.scaleMin, v)
                        return next
                      })
                    }}
                  />
                  <em>{scatter[sl.key].toFixed(sl.step >= 1 ? 0 : sl.step >= 0.1 ? 1 : 2)}</em>
                </label>
              ))}

              <p className="hint-text">
                Placed <strong>{placed.drawn.toLocaleString()}</strong>
                {placed.fit < treeCount && (
                  <> — only {placed.fit.toLocaleString()} fit these rules</>
                )}
                . Every tree has its own seed; they draw as one instanced mesh
                per shape and level —{' '}
                {(lod.enabled ? lodReadout.on : lodReadout.off)?.meshes ?? '…'}{' '}
                draw calls.
              </p>

              <div className="panel-title">Planting mask</div>

              <label
                className="row"
                title="Plant only inside the area you paint. Painting turns this on."
              >
                <span>Limit to area</span>
                <input
                  type="checkbox"
                  checked={scatter.maskEnabled}
                  onChange={(e) =>
                    setScatter((c) => ({ ...c, maskEnabled: e.target.checked }))
                  }
                />
              </label>

              <div className="segmented">
                {(['off', 'paint', 'erase'] as const).map((t) => (
                  <button
                    key={t}
                    className={maskTool === t ? 'active' : ''}
                    onClick={() => {
                      setMaskTool(t)
                      if (t !== 'off') setScatter((c) => ({ ...c, maskEnabled: true }))
                    }}
                    title={
                      t === 'off'
                        ? 'Stop painting.'
                        : t === 'paint'
                          ? 'Left-drag on the land to mark where trees may grow.'
                          : 'Left-drag to remove painted area.'
                    }
                  >
                    {t === 'off' ? 'Brush off' : t === 'paint' ? 'Paint' : 'Erase'}
                  </button>
                ))}
              </div>

              <label className="row" title="Brush size, in world units.">
                <span>Brush</span>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={maskRadius}
                  onChange={(e) => setMaskRadius(Number(e.target.value))}
                />
                <em>{maskRadius}</em>
              </label>

              <div className="panel-actions">
                <button onClick={() => setMask(emptyMask())} title="Erase the whole mask.">
                  Clear
                </button>
                <button
                  onClick={() => {
                    const m = emptyMask()
                    m.data.fill(1)
                    setMask(m)
                  }}
                  title="Paint the whole map (trees still only grow on suitable ground)."
                >
                  Fill all
                </button>
              </div>

              <p className="hint-text">
                {painting
                  ? 'Left-drag paints; right-drag orbits, wheel zooms.'
                  : scatter.maskEnabled && !mask.data.some((v) => v)
                    ? 'The mask is empty, so no trees will grow — paint an area.'
                    : 'Turn the brush on to paint where trees may grow.'}
              </p>

              <div className="panel-title">Tree shape</div>

              <label
                className="row"
                title="Which L-system recipe grows the trees. Picking one loads its settings into the sliders below; Mixed plants all three presets in stands."
              >
                <span>Species</span>
                <select
                  value={tree.species}
                  onChange={(e) => {
                    const v = e.target.value as SpeciesName | 'mixed'
                    setTree((t) =>
                      v === 'mixed'
                        ? { ...t, species: 'mixed' }
                        : paramsFromSpecies(v, t.seed),
                    )
                  }}
                >
                  <option value="mixed">Mixed (3 presets)</option>
                  {SPECIES_NAMES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              {treeMixed && (
                <p className="hint-text">
                  Pick a single species to edit its parameters — the sliders
                  regrow the whole forest live.
                </p>
              )}

              {TREE_SLIDERS.map((sl) => (
                <label key={sl.key} className="row" title={sl.title}>
                  <span>{sl.label}</span>
                  <input
                    type="range"
                    min={sl.min}
                    max={sl.max}
                    step={sl.step}
                    value={tree[sl.key]}
                    disabled={treeMixed}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setTree((t) => ({ ...t, [sl.key]: v }))
                    }}
                  />
                  <em>
                    {tree[sl.key].toFixed(
                      sl.step >= 1 ? 0 : sl.step >= 0.1 ? 1 : 2,
                    )}
                  </em>
                </label>
              ))}

              <div className="panel-actions">
                <button
                  disabled={treeMixed}
                  onClick={() =>
                    setTree((t) => ({
                      ...t,
                      seed: Math.floor(Math.random() * 1000),
                    }))
                  }
                  title="Grow a different set of trees from the same recipe."
                >
                  Randomize seed
                </button>
              </div>

              <div className="tree-stats" title="Averages for one tree of the current set. Forest ≈ trees drawn × average triangles.">
                <span>Triangles</span>
                <em>{treeSet.stats.triangles.toLocaleString()}</em>
                <span>Branches</span>
                <em>{treeSet.stats.branches.toLocaleString()}</em>
                <span>Leaves</span>
                <em>{treeSet.stats.leaves.toLocaleString()}</em>
                <span>Tris per LOD</span>
                <em>{treeSet.stats.lodTriangles.join(' / ')}</em>
                <span>Generation</span>
                <em>
                  {treeSet.stats.genMs.toFixed(1)} ms ·{' '}
                  {treeSet.stats.variants} shapes
                </em>
                <span>Forest ≈</span>
                <em>
                  {showTrees
                    ? (
                        placed.drawn * treeSet.stats.triangles
                      ).toLocaleString()
                    : 0}{' '}
                  tris
                </em>
              </div>
              {!treeMixed && treeSet.stats.generations < tree.generations && (
                <p className="hint-text">
                  Capped at {treeSet.stats.generations} generations — more
                  would make a tree too large to build.
                </p>
              )}

              <div className="panel-title">Look &amp; season</div>

              <div className="segmented" title="Shading style for trees, ivy and fallen leaves.">
                {TREE_LOOKS.map((l) => (
                  <button
                    key={l}
                    className={look === l ? 'active' : ''}
                    onClick={() => setLook(l)}
                    title={
                      l === 'realistic'
                        ? 'Smooth, natural lighting.'
                        : l === 'flat'
                          ? 'Every triangle lit as one flat facet — a low-poly look.'
                          : 'Light snapped to three bands, like a cartoon.'
                    }
                  >
                    {l[0].toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>

              <div className="segmented" title="Changes leaf colour, how many leaves stay on, and the fallen leaves on the ground. Instant — no tree is regrown.">
                {SEASON_NAMES.map((sn) => (
                  <button
                    key={sn}
                    className={season === sn ? 'active' : ''}
                    onClick={() => setSeason(sn)}
                  >
                    {sn[0].toUpperCase() + sn.slice(1)}
                  </button>
                ))}
              </div>

              <div className="panel-title">Ivy</div>

              {IVY_SLIDERS.map((sl) => (
                <label key={sl.key} className="row" title={sl.title}>
                  <span>{sl.label}</span>
                  <input
                    type="range"
                    min={sl.min}
                    max={sl.max}
                    step={sl.step}
                    value={ivy[sl.key]}
                    disabled={sl.key !== 'plants' && ivy.plants === 0}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setIvy((c) => ({ ...c, [sl.key]: v }))
                    }}
                  />
                  <em>{ivy[sl.key].toFixed(sl.step >= 1 ? 0 : sl.step >= 0.1 ? 1 : sl.step >= 0.01 ? 2 : 3)}</em>
                </label>
              ))}
              {ivy.plants === 0 && (
                <p className="hint-text">
                  Raise Ivy plants to grow ivy up the trunks and over steep banks.
                </p>
              )}

              <div className="panel-title">Level of detail</div>

              <label
                className="row"
                title="Draw trees at a cheaper level of detail the farther they are from the camera. Every level is grown from the same recipe."
              >
                <span>Enable LOD</span>
                <input
                  type="checkbox"
                  checked={lod.enabled}
                  onChange={(e) =>
                    setLod((l) => ({ ...l, enabled: e.target.checked }))
                  }
                />
              </label>

              <label
                className="row"
                title="Draws a coloured ring on the ground at each switch distance and tints every tree by the level it is drawn at now."
              >
                <span>Debug view</span>
                <input
                  type="checkbox"
                  checked={lod.debug}
                  disabled={!lod.enabled}
                  onChange={(e) =>
                    setLod((l) => ({ ...l, debug: e.target.checked }))
                  }
                />
              </label>

              {(
                [
                  ['LOD1 at', 'Trees farther than this from the camera drop to LOD1: one generation fewer, half the leaves (bigger), 4–5 sides.'],
                  ['LOD2 at', 'Beyond this: trunk and main limbs only, with the leaves merged into a few clusters.'],
                  ['LOD3 at', 'Beyond this: a single blob in the tree’s average colour.'],
                ] as const
              ).map(([label, title], i) => (
                <label key={label} className="row" title={title}>
                  <span style={{ color: LOD_COLORS[i + 1] }}>{label}</span>
                  <input
                    type="range"
                    min={10}
                    max={250}
                    step={5}
                    value={lod.thresholds[i]}
                    onChange={(e) => setLodThreshold(i, Number(e.target.value))}
                  />
                  <em>{lod.thresholds[i]}</em>
                </label>
              ))}

              <label
                className="row"
                title="A dead band around each distance: a tree only switches to a farther level once it is this far PAST the threshold, and back only once it is this far inside it, so trees on a boundary don't flicker."
              >
                <span>Hysteresis</span>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={1}
                  value={Math.round(lod.hysteresis * 100)}
                  onChange={(e) =>
                    setLod((l) => ({
                      ...l,
                      hysteresis: Number(e.target.value) / 100,
                    }))
                  }
                />
                <em>{Math.round(lod.hysteresis * 100)}%</em>
              </label>

              <div
                className="tree-stats tree-stats--lod"
                title="Latest reading with LOD off and with it on. Flip the Enable LOD switch to fill the other column. Frame tris is everything the GPU drew (terrain, water, trees, shadow pass)."
              >
                <span />
                <b>LOD off</b>
                <b>LOD on</b>
                <span>Tree tris</span>
                <em>{lodReadout.off ? lodReadout.off.treeTris.toLocaleString() : '—'}</em>
                <em>{lodReadout.on ? lodReadout.on.treeTris.toLocaleString() : '—'}</em>
                <span>Frame tris</span>
                <em>{lodReadout.off ? lodReadout.off.frameTris.toLocaleString() : '—'}</em>
                <em>{lodReadout.on ? lodReadout.on.frameTris.toLocaleString() : '—'}</em>
                <span>FPS</span>
                <em>{lodReadout.off ? Math.round(lodReadout.off.fps) : '—'}</em>
                <em>{lodReadout.on ? Math.round(lodReadout.on.fps) : '—'}</em>
              </div>
              {lodReadout.on && lod.enabled && (
                <p className="hint-text">
                  Trees per level:{' '}
                  {lodReadout.on.byLevel.map((n, l) => (
                    <span key={l} style={{ color: LOD_COLORS[l] }}>
                      {l > 0 && ' · '}L{l} {n}
                    </span>
                  ))}
                </p>
              )}
              <p className="hint-text">
                Flip Enable LOD to fill both columns. FPS tops out at your
                display’s refresh rate, so the triangle counts show the
                saving even when FPS can’t.
              </p>
    </>
  )
}
