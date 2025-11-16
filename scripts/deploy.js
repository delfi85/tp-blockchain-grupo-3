const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Desplegando CertiVax...\n");

  // Hash del contrato
  const contractHash = ethers.keccak256(ethers.toUtf8Bytes("CertiVax v1.0"));

  const CertiVax = await ethers.getContractFactory("CertiVax");
  const certiVax = await CertiVax.deploy(contractHash);
  await certiVax.waitForDeployment();

  const address = await certiVax.getAddress();

  console.log("✅ CertiVax desplegado en:", address);
  console.log("\n📋 Configuración para el frontend:");
  console.log(`   CONTRACT_ADDRESS = "${address}"`);
  console.log("\n📄 Copiar ABI al frontend:");
  console.log("   cp artifacts/contracts/MiContrato.sol/CertiVax.json frontend/src/");
  console.log("\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});