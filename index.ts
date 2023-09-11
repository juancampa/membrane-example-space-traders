// `nodes` contain any nodes you add from the graph (dependencies)
// `root` is a reference to this program's root node
// `state` is an object that persists across program updates. Store data here.
import { nodes, root, state } from "membrane";

export async function mine({ symbol }) {
  await root.mining({ symbol }).start();
}

state.ships = state.ships ?? {};

// Helper function to run an action after a cooldown
// Delay can be either a number (relative seconds from now) or a string (absolute date)
async function goTo(
  self: any,
  state: keyof typeof MiningBehavior,
  time: number | string = 0
) {
  const ship = getShip(self);
  if (typeof time === "string") {
    ship.timer = await self[state].$invokeAt(new Date(time));
  } else {
    ship.timer = await self[state].$invokeIn(time);
  }
}

// Helper function to get the state of a specific ship.
function getShip(self) {
  const symbol = self.$argsAt(root.mining).symbol;
  if (!state.ships[symbol]) {
    state.ships[symbol] = {
      // Keep a reference to the ship node in the space-traders driver.
      inner: nodes.space_traders.ships.one({ symbol }),
      timer: null,
      // How much profit this program has generated using this ship
      profit: 0,
      // The asteroid waypoint that also has a marketplace
      waypointSymbol: null,
    };
  }
  return state.ships[symbol];
}

export const Root = {
  status: (_, { self }) => {
    let total = 0;
    for (const ship of Object.values(state.ships)) {
      total += (ship as any).profit;
    }
    return `Profit: ${total}`;
  },
};

export const MiningBehavior = {
  async stop(_, { self }) {
    const ship = getShip(self);
    if (ship.timer) {
      unsubscribe(ship.timer);
      ship.timer = null;
    }
  },
  async start(_, { self }) {
    const ship = getShip(self);
    ship.mining = {
      deposits: [],
      marketplaces: [],
      profit: ship.mining?.profit ?? 0,
      yield: ship.mining?.yield ?? 0,
    };
    const system: space_traders.System = await ship.inner.system.$get();

    let page: space_traders.WaypointPage | undefined = system.waypoints.page;
    let waypoints: any[] = [];

    // Paginate through all waypoints in the system
    while (page) {
      const { next, items } = await page.$query(
        "next items { x y symbol traits market { exchange }}"
      );

      // For now we only support selling at the same place as the deposit
      for (const waypoint of items ?? []) {
        const { traits } = waypoint;
        const isAsteroid = traits.some((t) => t.symbol.endsWith("_DEPOSITS"));
        const isMarketplace = traits.some((t) => t.symbol === "MARKETPLACE");
        if (isAsteroid && isMarketplace) {
          ship.waypointSymbol = waypoint.symbol;
          break;
        }
      }
      if (ship.waypointSymbol) {
        break;
      }
      page = next;
    }
    if (!ship.waypointSymbol) {
      throw new Error("No deposit/marketplace waypoint found in this system");
    }

    // Ship might be in cooldown from another action or a previous run
    const cooldown = await ship.inner.cooldown.$get();
    goTo(self, "navigateToDeposit", cooldown);
  },

  async navigateToDeposit(_, { self }) {
    const ship = getShip(self);
    const nav = await ship.inner.nav.$get();

    await ship.inner.orbit();
    const location = nav.route?.destination?.symbol;
    const waypointSymbol = ship.waypointSymbol;
    if (location !== waypointSymbol) {
      // Navigate to the deposit
      const { nav } = await ship.inner.navigate({ waypointSymbol });
      goTo(self, "doExtract", nav.route.arrival);
    } else {
      console.log("Ship already at waypoint", waypointSymbol);
      goTo(self, "doExtract");
    }
  },

  async doExtract(_, { self }) {
    const ship = getShip(self);

    // Extract!
    let extraction: any;
    let cooldown: any;
    let cargo: any;
    try {
      const data = await ship.inner.extract();
      extraction = data.extraction;
      cooldown = data.cooldown;
      cargo = data.cargo;
    } catch (err) {
      if (err.message.includes("maximum capacity")) {
        // Cargo is full (probably from a previous run)
        goTo(self, "trade");
        return;
      }
      throw err;
    }
    console.log(
      `Extracted ${extraction.yield.units} of ${extraction.yield.symbol}!`
    );

    // Check if the cargo is full
    const { capacity, units } = cargo;
    if (units >= capacity) {
      goTo(self, "trade", cooldown.remainingSeconds);
    } else {
      // Keep extracting
      goTo(self, "doExtract", cooldown.remainingSeconds);
    }
  },

  async trade(_, { self }) {
    const ship = getShip(self);
    await ship.inner.dock();

    // Sell all cargo
    const { inventory } = await ship.inner.cargo;
    for (let { symbol, units } of inventory) {
      try {
        const { transaction } = await ship.inner.sell({ symbol, units });
        ship.profit = (ship.profit ?? 0) + transaction.totalPrice;
        console.log(
          `Sold ${units} of ${symbol} for ${transaction.totalPrice}!`
        );
      } catch (e) {
        console.log("Failed to sell", e);
      }
    }
    await ship.inner.orbit();
    goTo(self, "navigateToDeposit", 1);
  },
};
