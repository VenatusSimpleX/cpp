import { Button, Card, Checkbox, Menu, MenuItem } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { useAtom, useAtomValue } from 'jotai'
import { groupBy, sortBy, without } from 'ramda'
import React from 'react'
import { useAtoms, useCpp, useGameAdapter } from '../Cpp'

export function ForbiddenFormulaTag({ tag, text }: { tag: string; text: React.ReactNode }) {
  const atoms = useAtoms()
  const [tags, setTags] = useAtom(atoms.forbiddenFormulaTagsAtom)
  return (
    <MenuItem
      icon={tags.includes(tag) ? 'tick' : 'blank'}
      text={text}
      onClick={() =>
        setTags((t) => {
          if (t.includes(tag)) return without([tag], t)
          return [...t, tag]
        })
      }
    />
  )
}

export function ConfigButton() {
  const ga = useGameAdapter()
  const tags = Object.entries(ga.getFormulaTagNames())
  return (
    <Popover2
      usePortal={true}
      minimal={true}
      content={
        <Menu>
          {tags.map(([k, v]) => {
            return <ForbiddenFormulaTag key={k} tag={k} text={v} />
          })}
        </Menu>
      }
      position="bottom-left"
    >
      <Button icon={'properties'} minimal={true} rightIcon={'chevron-down'}>
        选项
      </Button>
    </Popover2>
  )
}

export function ForbiddenStageIdTag({ stageId }: { stageId: string }) {
  const ga = useGameAdapter()
  const stageInfo = ga.getStageInfos()
  const stage = stageInfo[stageId]
  const cpp = useCpp()
  const [ids, setIds] = useAtom(cpp.preferenceAtoms.forbiddenStageIdsAtom)

  return (
    <Checkbox
      style={{ marginBottom: 0 }}
      checked={!ids.includes(stageId)}
      title={`${stageId}: ${stage.name}`}
      labelElement={
        <>
          <code title={`${stageId}: ${stage.name}`}>{stage.code}</code>
        </>
      }
      inline={true}
      onChange={() =>
        setIds((t) => {
          if (t.includes(stageId)) return without([stageId], t)
          return [...t, stageId]
        })
      }
    />
  )
}

function makeNumericSortable(x: string) {
  return x.replace(/\d+/g, (y) => String(y).padStart(20, '0'))
}

export function StagePopover() {
  const ga = useGameAdapter()
  const stageInfo = ga.getStageInfos()
  const allStageIds = Object.keys(stageInfo)
  const grouped = sortBy(
    (x) => makeNumericSortable(x[0]),
    Object.entries(
      groupBy(
        (x: string) => {
          return stageInfo[x].zoneId
        },
        sortBy((x) => {
          return makeNumericSortable(x)
        }, allStageIds),
      ),
    ),
  )

  return (
    <div style={{ minWidth: '200px', maxWidth: '60vw', maxHeight: '80vh', overflow: 'auto' }}>
      {grouped.map(([k, stages]) => {
        const zoneName = ga.getZoneNames()[k] || k
        return (
          <>
            <Card style={{ padding: 15 }}>
              <h4 style={{ margin: 0, padding: 0 }}>
                {zoneName}
                <span style={{ opacity: 0.5, fontWeight: 'normal' }}> ({k})</span>
              </h4>
              {stages.map((x) => {
                return <ForbiddenStageIdTag stageId={x} key={x} />
              })}
            </Card>
          </>
        )
      })}
    </div>
  )
}

export function StageButton() {
  const ga = useGameAdapter()
  const cpp = useCpp()
  const stageInfo = ga.getStageInfos()
  const forbiddenStageIds = useAtomValue(cpp.preferenceAtoms.forbiddenStageIdsAtom)
  const allStageIds = Object.keys(stageInfo)
  const now = without(forbiddenStageIds, allStageIds).length
  const all = allStageIds.length

  return (
    <Popover2 usePortal={true} minimal={true} content={<StagePopover />} position="bottom-left">
      <Button icon={'record'} minimal={true} rightIcon={'chevron-down'}>
        关卡 {now}/{all}
      </Button>
    </Popover2>
  )
}
