const { ethers } = require("hardhat");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function getStateName(state) {
  const states = ["Created", "Registered", "PendingReview", "Verified", "InTracking", "Updated", "Closed", "Rejected"];
  return states[state];
}

function getVerifStateName(state) {
  const states = ["Pending", "Verified", "Revoked"];
  return states[state];
}

function getEventTypeName(type) {
  const types = ["Vaccination", "HealthCheck", "Feeding"];
  return types[type];
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("   🐄 CERTIVAX - Demo Interactiva");
  console.log("═══════════════════════════════════════════════════\n");

  const [owner, vet, feedOp, auditor, farmer] = await ethers.getSigners();

  console.log("📋 Roles disponibles:");
  console.log(`   [1] Owner:   ${owner.address}`);
  console.log(`   [2] Vet:     ${vet.address}`);
  console.log(`   [3] FeedOp:  ${feedOp.address}`);
  console.log(`   [4] Auditor: ${auditor.address}`);
  console.log(`   [5] Farmer:  ${farmer.address}\n`);

  // Deploy
  console.log("🚀 Desplegando contrato...");
  const contractHash = ethers.keccak256(ethers.toUtf8Bytes("CertiVax v1.0"));
  const CertiVax = await ethers.getContractFactory("CertiVax");
  const certiVax = await CertiVax.deploy(contractHash);
  await certiVax.waitForDeployment();
  console.log(`✅ Contrato: ${await certiVax.getAddress()}\n`);

  // Asignar roles
  await certiVax.assignRole(vet.address, 2);
  await certiVax.assignRole(feedOp.address, 3);
  await certiVax.assignRole(auditor.address, 4);
  await certiVax.assignRole(farmer.address, 5);
  console.log("✓ Roles asignados\n");

  let continuar = true;

  while (continuar) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("MENÚ PRINCIPAL");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[1] Crear animal");
    console.log("[2] Crear registro (vacunación/control/alimentación)");
    console.log("[3] Verificar registro (Auditor)");
    console.log("[4] Revocar registro (Auditor)");
    console.log("[5] Ver información de animal");
    console.log("[6] Ver historial completo");
    console.log("[7] Cerrar animal");
    console.log("[0] Salir");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const opcion = await question("Seleccione opción: ");

    try {
      switch(opcion) {
        case "1": // Crear animal
          const animalId = await question("🐄 ID del animal (ej: VACA-001): ");
          await certiVax.connect(farmer).createAnimal(animalId);
          console.log(`✅ Animal ${animalId} creado exitosamente\n`);

          const info = await certiVax.getAnimalInfo(animalId);
          console.log(`   📊 Quality Score: ${info[0]}/100`);
          console.log(`   📍 Estado: ${getStateName(info[2])}\n`);
          break;

        case "2": // Crear registro
          const animalReg = await question("🐄 ID del animal: ");
          console.log("\nTipo de evento:");
          console.log("  [0] Vacunación");
          console.log("  [1] Control Sanitario");
          console.log("  [2] Alimentación");
          const tipo = await question("Seleccione tipo: ");

          console.log("\n📄 Metadatos (JSON):");
          if (tipo === "0") {
            const vaccine = await question("  Vacuna: ");
            const dose = await question("  Dosis: ");
            const batch = await question("  Lote: ");
            const metaJson = JSON.stringify({ vaccine, dose, batch });
            const hash = ethers.keccak256(ethers.toUtf8Bytes(metaJson));

            await certiVax.connect(vet).createRecord(animalReg, tipo, hash, metaJson);
            console.log(`✅ Registro de vacunación creado\n`);
          } else if (tipo === "1") {
            const weight = await question("  Peso: ");
            const temp = await question("  Temperatura: ");
            const condition = await question("  Condición: ");
            const metaJson = JSON.stringify({ weight, temperature: temp, condition });
            const hash = ethers.keccak256(ethers.toUtf8Bytes(metaJson));

            await certiVax.connect(vet).createRecord(animalReg, tipo, hash, metaJson);
            console.log(`✅ Registro de control sanitario creado\n`);
          } else {
            const foodType = await question("  Tipo de alimento: ");
            const quantity = await question("  Cantidad: ");
            const metaJson = JSON.stringify({ type: foodType, quantity });
            const hash = ethers.keccak256(ethers.toUtf8Bytes(metaJson));

            await certiVax.connect(feedOp).createRecord(animalReg, tipo, hash, metaJson);
            console.log(`✅ Registro de alimentación creado\n`);
          }
          break;

        case "3": // Verificar registro
          const recordIdVerify = await question("🔍 ID del registro a verificar: ");
          await certiVax.connect(auditor).verifyRecord(recordIdVerify);
          console.log(`✅ Registro #${recordIdVerify} verificado\n`);

          const rec = await certiVax.getRecord(recordIdVerify);
          const animalInfo = await certiVax.getAnimalInfo(rec.animalId);
          console.log(`   📊 Quality Score actualizado: ${animalInfo[0]}/100\n`);
          break;

        case "4": // Revocar registro
          const recordIdRevoke = await question("❌ ID del registro a revocar: ");
          const reason = await question("📝 Motivo del rechazo: ");
          await certiVax.connect(auditor).revokeRecord(recordIdRevoke, reason);
          console.log(`❌ Registro #${recordIdRevoke} revocado\n`);
          break;

        case "5": // Ver info de animal
          const animalView = await question("🐄 ID del animal: ");
          const [score, updated, state, active, total] = await certiVax.getAnimalInfo(animalView);
          console.log(`\n📊 Información de ${animalView}:`);
          console.log(`   Quality Score: ${score}/100`);
          console.log(`   Estado: ${getStateName(state)}`);
          console.log(`   Activo: ${active}`);
          console.log(`   Total registros: ${total}\n`);
          break;

        case "6": // Ver historial
          const animalHist = await question("🐄 ID del animal: ");
          const recordIds = await certiVax.getAnimalRecords(animalHist);
          console.log(`\n📁 Historial de ${animalHist} (${recordIds.length} registros):\n`);

          for (let id of recordIds) {
            const record = await certiVax.getRecord(id);
            console.log(`   Registro #${id}:`);
            console.log(`     Tipo: ${getEventTypeName(record.eventType)}`);
            console.log(`     Estado: ${getVerifStateName(record.state)}`);
            console.log(`     Actor: ${record.actor}`);
            console.log(`     Datos: ${record.metaJson}\n`);
          }
          break;

        case "7": // Cerrar animal
          const animalClose = await question("🐄 ID del animal a cerrar: ");
          await certiVax.closeAnimal(animalClose);
          console.log(`✅ Animal ${animalClose} cerrado\n`);
          break;

        case "0":
          continuar = false;
          console.log("\n👋 Finalizando demo...\n");
          break;

        default:
          console.log("\n❌ Opción inválida\n");
      }
    } catch (error) {
      console.log(`\n❌ Error: ${error.message}\n`);
    }

    if (continuar) {
      await question("Presione ENTER para continuar...");
      console.log("\n");
    }
  }

  rl.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });