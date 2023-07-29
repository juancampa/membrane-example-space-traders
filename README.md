# Play SpaceTraders on Membrane

This is an example of how to play [Space Trades](https://spacetraders.io) (API based game) using [Membrane](https://membrane.io).

This example implements a basic extract/trade cycle for any number of ships but only works in asteroid fields that also have a marketplace (i.e. starting systems). Ships will navigate to the asteroid field in their current system and start mining. Once the ship's cargo is full, it will dock to trade. Rinse and repeat.

It's intended to be a good starting point for implementing more advanced logic.

<video autoplay loop muted playsinline>
  <source src="" type="video/mp4">
</video>

https://github.com/juancampa/membrane-example-space-traders/assets/1410520/4e0b0717-294a-4d8e-b831-029fc60bd902


## Why play SpaceTraders on Membrane

 - Code can be modified on the fly without losing state thanks to Membrane's durable program architecture
 - Complete visibility into what your code is doing and will be doing next (see video above)
 - Rate limits are handled globally by the space-traders driver (a dependency of this program)
 - It's easy to re-run any action executed by the program manually.
 - It's a hosted service so your code continues running 24/7.

## Install

Paste the following URL in your browser to open the directory inside the [Membrane VSCode Extension](https://marketplace.visualstudio.com/items?itemName=membrane.membrane).

vscode://membrane.membrane/directory/example-space-traders
