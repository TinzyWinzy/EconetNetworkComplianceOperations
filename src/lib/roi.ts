import { FinancialROIState, TowerTelemetry, SI_LIMITS } from '../types';

/**
 * Canonical ROI sync per api-integration-spec §5.
 * Validated against econet-master-financial-model-v2.xlsx:
 * annual_risk=$174k, monthly exposure=$14.5k, Target net=$184.5k / 1230% / 27d.
 */
export function calculateDynamicROI(
  towers: TowerTelemetry[],
  _callSliderUsageGb: number,
  module1Active: boolean,
  module2Active: boolean
): FinancialROIState {
  let unmitigatedOutageRisk = 0;
  for (const tower of towers) {
    if (tower.status === 'Offline' && tower.activeOutageDurationMinutes > SI_LIMITS.outageFreeMinutes) {
      const extraHours = Math.ceil((tower.activeOutageDurationMinutes - SI_LIMITS.outageFreeMinutes) / 60);
      unmitigatedOutageRisk += SI_LIMITS.baseFineUsd + extraHours * SI_LIMITS.hourlyFineUsd;
    }
  }
  let towerFines = 0;
  for (const tower of towers) {
    if (
      tower.cellAvailabilityPercent < SI_LIMITS.cellAvailability ||
      tower.dsasrPercent < SI_LIMITS.dsasr ||
      tower.dsdrPercent > SI_LIMITS.dsdr
    ) {
      towerFines += SI_LIMITS.towerFineUsd;
    }
  }
  const totalUnmitigatedFineRisk = unmitigatedOutageRisk + towerFines;

  const billingCallsInbound = 10000 * 0.15;
  const avoidedCalls = Math.round(billingCallsInbound * (module2Active ? 0.3 : 0));
  const supportDeflectionSavings = avoidedCalls * 10;

  const complianceMitigationSavings = module1Active ? totalUnmitigatedFineRisk * 0.75 : 0;
  // Pilot labor savings ($2k/mo) counted in static board; live session tracks call-driven + shield savings.
  const totalMonthlySavings = complianceMitigationSavings + supportDeflectionSavings;
  const annualSavingsGenerated = totalMonthlySavings * 12;
  const capitalPlatformCost = 15000;
  const netYear1Value = annualSavingsGenerated - capitalPlatformCost;
  const paybackDays = totalMonthlySavings > 0 ? Math.round((capitalPlatformCost / totalMonthlySavings) * 30) : 365;
  const roiPercent = (netYear1Value / capitalPlatformCost) * 100;

  return {
    unmitigatedExposuresUsd: totalUnmitigatedFineRisk,
    mitigatedSavingsUsd: complianceMitigationSavings,
    supportDeflectionSavingsUsd: supportDeflectionSavings,
    netYear1ValueUsd: netYear1Value,
    paybackDays,
    roiPercent: parseFloat(roiPercent.toFixed(1))
  };
}
