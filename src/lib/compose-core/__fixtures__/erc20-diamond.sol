// SPDX-License-Identifier: MIT
 pragma solidity >=0.8.30;

/* Compose
 * https://compose.diamonds
 */

import "@perfect-abstractions/compose/diamond/DiamondMod.sol" as DiamondMod;
import "@perfect-abstractions/compose/interfaces/IERC20.sol";

contract Diamond {
    constructor(address[] memory _facets) {
        DiamondMod.addFacets(_facets);
        
        
    }

    fallback() external payable {
        DiamondMod.diamondFallback();
    }

    receive() external payable {}
}