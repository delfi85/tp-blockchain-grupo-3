const { ethers } = require("hardhat");

// Funciones auxiliares para nombres de estados
function getStateName(state) {
  const states = ["Created", "Registered", "PendingReview", "Verified", "InTracking", "Updated", "Closed", "Rejected"];
  return states[state] || "Unknown";
}

function getVerifStateName(state) {
  const states = ["Pending", "Verified", "Revoked"];
  return states[state] || "Unknown";
}

function getEventTypeName(type) {
  const types = ["Vaccination", "HealthCheck", "Feeding"];
  return types[type] || "Unknown";
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("   🐄 DEMO CERTIVAX - Sistema de Trazabilidad   ");
  console.log("═══════════════════════════════════════════════════\n");

  // Obtener signers
  const [owner, vet, feedOp, auditor, farmer, buyer] = await ethers.getSigners();

  console.log("📋 Cuentas disponibles:");
  console.log(`   Owner:   ${owner.address}`);
  console.log(`   Vet:     ${vet.address}`);
  console.log(`   FeedOp:  ${feedOp.address}`);
  console.log(`   Auditor: ${auditor.address}`);
  console.log(`   Farmer:  ${farmer.address}`);
  console.log(`   Buyer:   ${buyer.address}\n`);

  // Deploy del contrato
  console.log("🚀 Desplegando contrato CertiVax...");
  const contractHash = ethers.keccak256(ethers.toUtf8Bytes("CertiVax v1.0"));
  const CertiVax = await ethers.getContractFactory("CertiVax");
  const certiVax = await CertiVax.deploy(contractHash);
  await certiVax.waitForDeployment();

  const address = await certiVax.getAddress();
  console.log(`✅ Contrato desplegado en: ${address}\n`);

  // PASO 1: Asignación de Roles
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PASO 1: Asignación de Roles");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await certiVax.assignRole(vet.address, 2);
  console.log("   ✓ Veterinario asignado");
  await certiVax.assignRole(feedOp.address, 3);
  console.log("   ✓ Operador de alimentación asignado");
  await certiVax.assignRole(auditor.address, 4);
  console.log("   ✓ Auditor asignado");
  await certiVax.assignRole(farmer.address, 5);
  console.log("   ✓ Ganadero asignado");
  await certiVax.assignRole(buyer.address, 6);
  console.log("   ✓ Comprador asignado\n");

  // PASO 2: Creación de Animal
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PASO 2: Registro de Animal");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const animalId = "VACA-001";
  await certiVax.connect(farmer).createAnimal(animalId);
  let info = await certiVax.getAnimalInfo(animalId);
  console.log(`🐄 Animal creado: ${animalId}`);
  console.log(`   📊 Quality Score: ${info[0]}/100`);
  console.log(`   📍 Estado: ${getStateName(info[2])}\n`);

  // PASO 3: Registro de Vacunación
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PASO 3: Registro de Vacunación");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const certData = JSON.stringify({ vaccine: "Aftosa", dose: "5ml", batch: "A123" });
  const certHash = ethers.keccak256(ethers.toUtf8Bytes(certData));
  console.log("💉 Veterinario registra vacunación");
  await certiVax.connect(vet).createRecord(animalId, 0, certHash, certData);
  console.log("   ✓ Registro #1 creado\n");

  // PASO 4: Verificación por Auditor
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PASO 4: Verificación por Auditor");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await certiVax.connect(auditor).verifyRecord(1);
  console.log("✅ Auditor verificó el registro #1");
  info = await certiVax.getAnimalInfo(animalId);
  console.log(`   📊 Quality Score: ${info[0]}/100`);
  console.log(`   📍 Estado: ${getStateName(info[2])}\n`);

  // PASO 5: Historial Completo
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PASO 5: Consulta de Historial");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const recordIds = await certiVax.getAnimalRecords(animalId);
  console.log(`📁 Total de registros: ${recordIds.length}`);
  for (let id of recordIds) {
    const record = await certiVax.getRecord(id);
    console.log(`\n   Registro #${id}:`);
    console.log(`   - Tipo: ${getEventTypeName(record.eventType)}`);
    console.log(`   - Estado: ${getVerifStateName(record.state)}`);
    console.log(`   - Actor: ${record.actor}`);
  }

  console.log("\n\n✅ Demo completada exitosamente!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });