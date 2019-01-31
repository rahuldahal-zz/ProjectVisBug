import $ from 'blingblingjs'
import hotkeys from 'hotkeys-js'
import { TinyColor } from '@ctrl/tinycolor'
import { queryPage } from './search'
import { getStyles, camelToDash, isOffBounds, deepElementFromPoint } from '../utilities/'

const tip_map = new Map()

// todo: 
// - node recycling (for new target) no need to create/delete
// - make single function create/update
export function MetaTip(selectorEngine) {
  $('body').on('mousemove', mouseMove)

  hotkeys('esc', _ => removeAll())

  for (const {tip,e} of tip_map.values()) {
    if (!e.target) continue
      
    tip.style.display = 'block'
    tip.innerHTML = template(e.target).innerHTML
    tip.on('mouseout', mouseOut)
    tip.on('click', togglePinned)
  }

  return () => {
    $('body').off('mousemove', mouseMove)
    hotkeys.unbind('esc')
    hideAll()
  }
}

export function showTip(target, e) {
  // if node is in our hash (already created)
  if (tip_map.has(target)) {
    // return if it's pinned
    if (target.hasAttribute('data-metatip')) 
      return
    // otherwise update position
    const { tip } = tip_map.get(target)

    updateTip(tip, e)
  }
  // create new tip
  else {
    const tip = template(target)
    document.body.appendChild(tip)

    updateTip(tip, e)

    $(tip).on('query', linkQueryClicked)
    $(tip).on('unquery', linkQueryHoverOut)
    $(target).on('mouseout DOMNodeRemoved', mouseOut)
    $(target).on('click', togglePinned)

    tip_map.set(target, { tip, e })

    // tip.animate([
    //   {transform: 'translateY(-5px)', opacity: 0},
    //   {transform: 'translateY(0)', opacity: 1}
    // ], 150)
  }
}

export function updateTip(tip, e) {
  const { north, west } = mouse_quadrant(e)
  const {left, top}     = tip_position(tip, e, north, west)

  tip.style.left  = left
  tip.style.top   = top 

  tip.style.setProperty('--arrow', north 
    ? 'var(--arrow-up)'
    : 'var(--arrow-down)')

  tip.style.setProperty('--shadow-direction', north 
    ? 'var(--shadow-up)'
    : 'var(--shadow-down)')

  tip.style.setProperty('--arrow-top', !north 
    ? '-7px'
    : 'calc(100% - 1px)')

  tip.style.setProperty('--arrow-left', west 
    ? 'calc(100% - 15px - 15px)'
    : '15px')
}

export function hideAll() {
  for (const {tip} of tip_map.values()) {
    tip.style.display = 'none'
    $(tip).off('mouseout DOMNodeRemoved', mouseOut)
    $(tip).off('click', togglePinned)
    $('a', tip).off('click', linkQueryClicked)
  }
}

export function removeAll() {
  tip_map.forEach(({tip}, target) => {
    tip.remove()
    $(target).off('mouseout DOMNodeRemoved', mouseOut)
    $(target).off('click', togglePinned)
    $('a', tip).off('click', linkQueryClicked)
  })
  
  $('[data-metatip]').attr('data-metatip', null)

  tip_map.clear()
}

const template = el => {
  const { width, height } = el.getBoundingClientRect()
  const styles = getStyles(el)
    .map(style => Object.assign(style, {
      prop: camelToDash(style.prop)
    }))
    .filter(style => 
      style.prop.includes('font-family') 
        ? el.matches('h1,h2,h3,h4,h5,h6,p,a,date,caption,button,figcaption,nav,header,footer') 
        : true
    )
    .map(style => {
      if (style.prop.includes('color') || style.prop.includes('Color') || style.prop.includes('fill') || style.prop.includes('stroke'))
        style.value = `<span color style="background-color:${style.value};"></span>${new TinyColor(style.value).toHslString()}`

      if (style.prop.includes('font-family') && style.value.length > 25)
        style.value = style.value.slice(0,25) + '...'

      if (style.prop.includes('background-image'))
        style.value = `<a target="_blank" href="${style.value.slice(style.value.indexOf('(') + 2, style.value.length - 2)}">${style.value.slice(0,25) + '...'}</a>`

      // check if style is inline style, show indicator
      if (el.getAttribute('style') && el.getAttribute('style').includes(style.prop))
        style.value = `<span local-change>${style.value}</span>`
      
      return style
    })

  const localModifications = styles.filter(style =>
    el.getAttribute('style') && el.getAttribute('style').includes(style.prop)
      ? 1
      : 0)

  const notLocalModifications = styles.filter(style =>
    el.getAttribute('style') && el.getAttribute('style').includes(style.prop)
      ? 0
      : 1)
  
  let tip = document.createElement('pb-metatip')

  tip.meta = {
    el, 
    width, 
    height, 
    localModifications, 
    notLocalModifications,
  }

  return tip
}

const mouse_quadrant = e => ({
  north: e.clientY > window.innerHeight / 2,
  west:  e.clientX > window.innerWidth / 2
})

const tip_position = (node, e, north, west) => ({
  top: `${north
    ? e.pageY - node.clientHeight - 20
    : e.pageY + 25}px`,
  left: `${west
    ? e.pageX - node.clientWidth + 23
    : e.pageX - 21}px`,
})

const mouseOut = ({target}) => {
  if (!target.hasAttribute('data-metatip'))
    removeAll()
}

const togglePinned = e => {
  if (e.altKey) {
    !e.target.hasAttribute('data-metatip')
      ? e.target.setAttribute('data-metatip', true)
      : e.target.removeAttribute('data-metatip')
  }
}

const linkQueryClicked = ({detail}) => {
  if (!detail.text) return

  queryPage('[data-hover]', el =>
    el.setAttribute('data-hover', null))

  queryPage(detail.text + ':not([data-selected])', el =>
    detail.activator === 'mouseenter'
      ? el.setAttribute('data-hover', true)
      : selectorEngine.select(el))
}

const linkQueryHoverOut = e => {
  queryPage('[data-hover]', el =>
    el.setAttribute('data-hover', null))
}

const mouseMove = e => {
  const target = deepElementFromPoint(e.clientX, e.clientY)

  if (isOffBounds(target)) return

  e.altKey
    ? target.setAttribute('data-pinhover', true)
    : target.removeAttribute('data-pinhover')

  showTip(target, e)
}