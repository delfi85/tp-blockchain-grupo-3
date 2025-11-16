require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: [process.env.PRIVATE_KEY].filter(Boolean),
    },
    amoy: {
      url: "https://rpc-amoy.polygon.technology",
      accounts: [process.env.PRIVATE_KEY].filter(Boolean),
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonAmoy: process.env.POLYGONSCAN_API_KEY
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  }
};