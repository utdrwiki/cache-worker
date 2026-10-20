(() => {
  'use strict';

  const [map] = document.getElementsByTagName('form');
  const [playerElement] = document.getElementsByTagName('div');
  const buttons = document.getElementsByTagName('button');
  const images = document.getElementsByTagName('img');

  const walls = [
    [0, 0, 64, 240],
    [256, 0, 64, 240],
    [0, 186, 144, 54],
    [176, 186, 144, 54],
    [96, 0, 48, 16],
    [176, 0, 48, 16],
  ];
  const exits = [
    [144, 208, 32, 32],
    [64, 0, 32, 16],
    [144, 0, 32, 16],
    [224, 0, 32, 16],
  ];

  const pressed = {};
  let hasMoved = false;
  let lastFrame = 0;
  let animationFrame = 0;
  let exited = false;

  function handleExit(exit) {
    if (exited) {
      return;
    }
    const data = new FormData(map);
    const domain = new URL(location.href).hostname.split('.').slice(-2).join('.');
    document.cookie = `utdrforest-ts=${data.get('ts')}; max-age=86400; domain=${domain}; path=/; samesite=lax; secure`;
    document.cookie = `utdrforest-sig=${p[exit]}; max-age=86400; domain=${domain}; path=/; samesite=lax; secure`;
    location.reload();
    exited = true;
  }

  const getDX = () => (pressed.ArrowLeft || pressed.A || pressed.a) ?
    -1 :
    (pressed.ArrowRight || pressed.D || pressed.d) ?
      1 :
      0;

  const getDY = () => (pressed.ArrowUp || pressed.W || pressed.w) ?
    -1 :
    (pressed.ArrowDown || pressed.S || pressed.s) ?
      1 :
      0;

  const overlaps = (px, py, [wx, wy, ww, wh]) =>
    px < wx + ww && px + 19 > wx && py < wy + wh && py + 38 > wy;

  function movePlayer(dx, dy) {
    const oldX = Number(getComputedStyle(playerElement).left.slice(0, -2));
    const oldY = Number(getComputedStyle(playerElement).top.slice(0, -2));
    let x = oldX + dx * 8;
    let y = oldY + dy * 8;
    const exit = exits.findIndex((e, i) => overlaps(x, y, e));
    if (exit !== -1) {
      handleExit(exit);
      return;
    }
    if (walls.some(wall => overlaps(x, oldY, wall))) {
      x = oldX;
    }
    if (walls.some(wall => overlaps(oldX, y, wall))) {
      y = oldY;
    }
    if (x === oldX && y === oldY) {
      animationFrame = 0;
      playerElement.dataset.frame = 0;
      return;
    } else if (++animationFrame === 5) {
      animationFrame = 0;
      playerElement.dataset.frame = (Number(playerElement.dataset.frame || 0) + 1) % 4;
    }
    playerElement.style.left = `${x}px`;
    playerElement.style.top = `${y}px`;
    playerElement.className = `x${dx} y${dy}`;
    hasMoved = true;
  }

  function moveImages() {
    for (const image of images) {
      image.style.top = `${Number(image.style.top.slice(0, -2)) - 5}px`;
    }
  }

  function animate(time) {
    const elapsed = time - lastFrame;
    if (elapsed < 1000 / 30) {
      requestAnimationFrame(animate);
      return;
    }
    lastFrame = time;
    const dx = getDX();
    const dy = getDY();
    movePlayer(dx, dy);
    const xButton = (dx > 0) ? 'd' : (dx < 0) ? 'a' : '';
    const yButton = (dy > 0) ? 's' : (dy < 0) ? 'w' : '';
    for (const button of buttons) {
      if (button.classList.contains(xButton) || button.classList.contains(yButton)) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
    if (hasMoved) {
      moveImages();
    }
    requestAnimationFrame(animate);
  }

  document.addEventListener('keydown', event => {
    pressed[event.key] = true;
  });

  document.addEventListener('keyup', event => {
    delete pressed[event.key];
  });

  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      pressed[button.className] = true;
    });
    button.addEventListener('pointerup', event => {
      event.preventDefault();
      delete pressed[button.className];
    });
  }

  for (const image of images) {
    image.style.left = `${Number(image.dataset.x)}px`;
    image.style.top = `${64 - image.naturalHeight}px`;
  }

  requestAnimationFrame(animate);
})();
