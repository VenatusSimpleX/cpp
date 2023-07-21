import { useEffect, useState } from 'react'
import { badUrl, load } from '../pkg/blobcache'

export function CachedImg({
  src,
  width,
  height,
  alt,
  title,
  style,
  className,
}: {
  src: string
  width?: JSX.IntrinsicElements['img']['width']
  height?: JSX.IntrinsicElements['img']['height']
  alt?: JSX.IntrinsicElements['img']['alt']
  title?: JSX.IntrinsicElements['img']['title']
  style?: JSX.IntrinsicElements['img']['style']
  className?: JSX.IntrinsicElements['img']['className']
}) {
  const data = load(src)
  const [, render] = useState(0)

  useEffect(() => {
    if (typeof data === 'string') return
    let run = true
    void data.then(() => run && render((x) => x + 1)).catch(() => run && render((x) => x + 1))
    return () => {
      run = false
    }
  })

  if (!(typeof data === 'string')) {
    return <img width={width} height={height} alt={''} title={title} style={style} className={className} />
  }

  const bad = data === badUrl
  return (
    <img
      src={data}
      width={width}
      height={height}
      alt={alt}
      title={title}
      style={{
        ...style,
        overflow: 'hidden',
        overflowWrap: 'break-word',
        ...(bad
          ? {
              opacity: 0.25,
              color: 'red',
              border: '1px solid red',
            }
          : {}),
      }}
      className={(className || '') + ' ' + (bad ? 'cpp-bad-img' : '')}
    />
  )
}

export function EmptyIcon() {
  return <span className="bp4-menu-item-icon"></span>
}
